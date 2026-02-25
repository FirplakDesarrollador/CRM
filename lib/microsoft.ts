import { supabase } from './supabase';
import crypto from 'crypto';

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const SCOPES = [
    'offline_access',
    'openid',
    'profile',
    'email',
    'Tasks.ReadWrite',
    'Tasks.ReadWrite.Shared',
    'Group.Read.All',
    'Calendars.ReadWrite',
    'User.Read.All',
    'People.Read'
].join(' ');

// Encryption helper
const algorithm = 'aes-256-cbc';

function encrypt(text: string) {
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set');
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY not set');
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export function getMicrosoftAuthUrl(userId: string) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        response_type: 'code',
        redirect_uri: REDIRECT_URI!,
        response_mode: 'query',
        scope: SCOPES,
        state: userId, // Pass userId as state to verify callback
    });

    return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code: code,
        redirect_uri: REDIRECT_URI!,
        grant_type: 'authorization_code',
        scope: SCOPES,
    });

    const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Token exchange error:', error);
        throw new Error(error.error_description || 'Failed to exchange code for tokens');
    }

    return response.json();
}

export async function refreshMicrosoftToken(userId: string, refreshToken: string, supabaseClient = supabase) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES,
    });

    const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Token refresh error:', error);
        throw new Error(error.error_description || 'Failed to refresh token');
    }

    const data = await response.json();

    // Store new tokens
    await storeMicrosoftTokens(userId, data, supabaseClient);

    return data;
}

export async function storeMicrosoftTokens(userId: string, tokenData: any, supabaseClient = supabase) {
    const { access_token, refresh_token, id_token, expires_in, scope } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error } = await supabaseClient
        .from('CRM_MicrosoftTokens')
        .upsert({
            user_id: userId,
            access_token: encrypt(access_token),
            refresh_token: refresh_token ? encrypt(refresh_token) : null,
            id_token: id_token ? encrypt(id_token) : null,
            expires_at: expiresAt,
            scope: scope,
            updated_at: new Date().toISOString(),
        });

    if (error) throw error;
}

export async function getMicrosoftTokens(userId: string, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .from('CRM_MicrosoftTokens')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) return null;

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now >= expiresAt && data.refresh_token) {
        console.log('[Microsoft] Token expired, refreshing...');
        return refreshMicrosoftToken(userId, decrypt(data.refresh_token), supabaseClient);
    }

    return {
        access_token: decrypt(data.access_token),
        refresh_token: data.refresh_token ? decrypt(data.refresh_token) : null,
        expires_at: data.expires_at,
        scope: data.scope,
    };
}

export async function getPlannerTaskDetails(accessToken: string, taskId: string) {
    if (!accessToken) {
        throw new Error('Access token is required');
    }

    try {
        console.log(`[Microsoft API] Fetching task ${taskId}...`);

        const response = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Microsoft API] Error response from Graph API /planner/tasks:', response.status, errorText);
            throw new Error(`Graph API returned ${response.status}: ${errorText}`);
        }

        const task = await response.json();

        // Fetch details (description, checklist)
        try {
            const detailsResponse = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                }
            });
            if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                task.details = details;
            }
        } catch (err) {
            console.warn('[Microsoft API] Error fetching task details:', err);
        }

        // Fetch user info for assignments to populate attendees
        try {
            const assigneeIds = task.assignments ? Object.keys(task.assignments) : [];
            if (assigneeIds.length > 0) {
                // To avoid URL limits, we could filter by id or fetch each. There are usually few assignees.
                const userResponses = await Promise.all(assigneeIds.map(id =>
                    fetch(`https://graph.microsoft.com/v1.0/users/${id}?$select=id,displayName,mail,userPrincipalName`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    }).then(res => res.ok ? res.json() : null)
                ));
                task.resolvedAssignees = userResponses.filter(u => u !== null).map(u => ({
                    id: u.id,
                    name: u.displayName,
                    email: u.mail || u.userPrincipalName
                }));
            } else {
                task.resolvedAssignees = [];
            }
        } catch (err) {
            console.warn('[Microsoft API] Error fetching assignees:', err);
            task.resolvedAssignees = [];
        }

        return task;
    } catch (error) {
        console.error('[Microsoft API] Failed to fetch planner task:', error);
        throw error;
    }
}

/**
 * Search for users in the Microsoft tenant using the People API
 * This is the same API that Microsoft Teams uses for user search
 * and doesn't require Admin Consent (only People.Read scope)
 */
export async function searchMicrosoftUsers(accessToken: string, query: string) {
    console.log(`[Microsoft] Searching users with People API, query: ${query}`);

    // Primary method: Use People API search endpoint (same as Teams)
    const searchBody = {
        requests: [
            {
                entityTypes: ['person'],
                query: {
                    queryString: query
                },
                from: 0,
                size: 15
            }
        ]
    };

    try {
        const response = await fetch('https://graph.microsoft.com/v1.0/search/query', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchBody)
        });

        if (response.ok) {
            const data = await response.json();
            const hits = data.value?.[0]?.hitsContainers?.[0]?.hits || [];
            console.log(`[Microsoft] People Search results count: ${hits.length}`);

            return hits.map((hit: any) => {
                const person = hit.resource;
                return {
                    id: person.id,
                    displayName: person.displayName,
                    mail: person.scoredEmailAddresses?.[0]?.address || person.userPrincipalName,
                    userPrincipalName: person.userPrincipalName,
                    jobTitle: person.jobTitle
                };
            });
        }

        // If search/query fails, try /me/people endpoint
        console.log('[Microsoft] Search API failed, trying /me/people...');
    } catch (err) {
        console.error('[Microsoft] Search API error:', err);
    }

    // Fallback 1: Use /me/people endpoint with $search
    try {
        const peopleParams = new URLSearchParams({
            $search: `"${query}"`,
            $top: '15',
            $select: 'id,displayName,scoredEmailAddresses,jobTitle,userPrincipalName'
        });

        const peopleRes = await fetch(`https://graph.microsoft.com/v1.0/me/people?${peopleParams.toString()}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (peopleRes.ok) {
            const peopleData = await peopleRes.json();
            console.log(`[Microsoft] /me/people results count: ${peopleData.value?.length || 0}`);

            return (peopleData.value || []).map((person: any) => ({
                id: person.id,
                displayName: person.displayName,
                mail: person.scoredEmailAddresses?.[0]?.address,
                userPrincipalName: person.userPrincipalName,
                jobTitle: person.jobTitle
            }));
        }
    } catch (err) {
        console.error('[Microsoft] /me/people error:', err);
    }

    // Fallback 2: Try /users endpoint with filter (requires User.Read.All)
    console.log('[Microsoft] Falling back to /users endpoint...');
    const fallbackParams = new URLSearchParams({
        $select: 'displayName,mail,userPrincipalName,id,jobTitle',
        $filter: `startsWith(displayName,'${query}') or startsWith(mail,'${query}')`,
        $top: '10'
    });

    const fallbackRes = await fetch(`https://graph.microsoft.com/v1.0/users?${fallbackParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!fallbackRes.ok) {
        const error = await fallbackRes.json();
        console.error('[Microsoft] All search methods failed:', error);
        return [];
    }

    const fallbackData = await fallbackRes.json();
    console.log(`[Microsoft] /users fallback results: ${fallbackData.value?.length || 0}`);

    return (fallbackData.value || []).map((user: any) => ({
        id: user.id,
        displayName: user.displayName,
        mail: user.mail || user.userPrincipalName,
        userPrincipalName: user.userPrincipalName,
        jobTitle: user.jobTitle
    }));
}

/**
 * Create a calendar event in Microsoft Graph (with Teams support)
 */
export async function createMicrosoftEvent(accessToken: string, eventDetails: {
    subject: string;
    body: string;
    start: string;
    end: string;
    attendees: { email: string; name: string }[];
    isOnlineMeeting?: boolean;
}) {
    const event = {
        subject: eventDetails.subject,
        body: {
            contentType: 'HTML',
            content: eventDetails.body
        },
        start: {
            dateTime: eventDetails.start,
            timeZone: 'UTC'
        },
        end: {
            dateTime: eventDetails.end,
            timeZone: 'UTC'
        },
        location: {
            displayName: eventDetails.isOnlineMeeting ? 'Microsoft Teams Meeting' : ''
        },
        attendees: eventDetails.attendees.map(a => ({
            emailAddress: {
                address: a.email,
                name: a.name
            },
            type: 'required'
        })),
        isOnlineMeeting: eventDetails.isOnlineMeeting,
        onlineMeetingProvider: eventDetails.isOnlineMeeting ? 'teamsForBusiness' : undefined
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Create event error:', error);
        throw new Error(error.error?.message || 'Failed to create calendar event');
    }

    return response.json();
}

/**
 * Get Microsoft 365 Groups the user is a member of
 * These groups can have Planner plans associated with them
 */
export async function getMyGroups(accessToken: string) {
    console.log('[Microsoft] Fetching user groups...');

    const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$select=id,displayName,description&$top=50',
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Get groups error:', error);
        throw new Error(error.error?.message || 'Failed to get groups');
    }

    const data = await response.json();
    console.log(`[Microsoft] Found ${data.value?.length || 0} groups`);

    return data.value || [];
}

/**
 * Get Planner plans for a specific group
 */
export async function getGroupPlans(accessToken: string, groupId: string) {
    console.log(`[Microsoft] Fetching plans for group ${groupId}...`);

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/groups/${groupId}/planner/plans`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Get plans error:', error);
        throw new Error(error.error?.message || 'Failed to get plans');
    }

    const data = await response.json();
    console.log(`[Microsoft] Found ${data.value?.length || 0} plans`);

    return data.value || [];
}

/**
 * Get buckets for a specific Planner plan
 */
export async function getPlanBuckets(accessToken: string, planId: string) {
    console.log(`[Microsoft] Fetching buckets for plan ${planId}...`);

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/planner/plans/${planId}/buckets`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Get buckets error:', error);
        throw new Error(error.error?.message || 'Failed to get buckets');
    }

    const data = await response.json();
    console.log(`[Microsoft] Found ${data.value?.length || 0} buckets`);

    return data.value || [];
}

/**
 * Create a task in Microsoft Planner
 */
export async function createPlannerTask(accessToken: string, taskDetails: {
    planId: string;
    bucketId: string;
    title: string;
    dueDateTime?: string;
    assigneeIds?: string[];
    notes?: string;
    checklist?: string[];
}) {
    console.log('[Microsoft] Creating Planner task...', {
        planId: taskDetails.planId,
        bucketId: taskDetails.bucketId,
        title: taskDetails.title
    });

    // Build the task object
    const task: any = {
        planId: taskDetails.planId,
        bucketId: taskDetails.bucketId,
        title: taskDetails.title,
    };

    // Add due date if provided
    if (taskDetails.dueDateTime) {
        task.dueDateTime = taskDetails.dueDateTime;
    }

    // Add assignments if provided (assignees)
    // Note: User IDs from People API may include tenant suffix (userId@tenantId)
    // Planner expects just the userId, so we strip the tenant suffix
    if (taskDetails.assigneeIds && taskDetails.assigneeIds.length > 0) {
        task.assignments = {};
        for (const rawUserId of taskDetails.assigneeIds) {
            // Strip tenant ID if present (format: userId@tenantId -> userId)
            const userId = rawUserId.includes('@') ? rawUserId.split('@')[0] : rawUserId;
            // Assignment requires @odata.type and orderHint
            task.assignments[userId] = {
                "@odata.type": "#microsoft.graph.plannerAssignment",
                "orderHint": " !"
            };
        }
        console.log('[Microsoft] Task assignments:', JSON.stringify(task.assignments));
    }

    // Create the task
    const response = await fetch('https://graph.microsoft.com/v1.0/planner/tasks', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('[Microsoft] Create Planner task error:', error);
        throw new Error(error.error?.message || 'Failed to create Planner task');
    }

    const createdTask = await response.json();
    console.log(`[Microsoft] Created Planner task with ID: ${createdTask.id}`);

    // If there are notes or checklist, we need to update the task details separately
    if (taskDetails.notes || (taskDetails.checklist && taskDetails.checklist.length > 0)) {
        try {
            // Get the task details to get the @odata.etag
            const detailsResponse = await fetch(
                `https://graph.microsoft.com/v1.0/planner/tasks/${createdTask.id}/details`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );

            if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                const etag = details['@odata.etag'];

                // Prepare the update body
                const updateBody: any = {};

                if (taskDetails.notes) {
                    updateBody.description = taskDetails.notes;
                }

                if (taskDetails.checklist && taskDetails.checklist.length > 0) {
                    updateBody.checklist = {};
                    taskDetails.checklist.forEach((item, index) => {
                        // Planner checklist items need a unique ID (random string works) and an OrderHint
                        const itemId = `item_${index}_${Math.random().toString(36).substring(7)}`;
                        updateBody.checklist[itemId] = {
                            '@odata.type': '#microsoft.graph.plannerChecklistItem',
                            title: item,
                            isChecked: false,
                            orderHint: ' !' // ' !' is used to specify auto-ordering
                        };
                    });
                }

                // Update the task details
                await fetch(
                    `https://graph.microsoft.com/v1.0/planner/tasks/${createdTask.id}/details`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'If-Match': etag
                        },
                        body: JSON.stringify(updateBody)
                    }
                );
                console.log('[Microsoft] Updated Planner task details (notes/checklist)');
            }
        } catch (detailsError) {
            console.warn('[Microsoft] Failed to update task details:', detailsError);
            // Don't fail the whole operation if details fail
        }
    }

    return createdTask;
}

/**
 * Delete a task in Microsoft Planner
 */
export async function deletePlannerTask(accessToken: string, taskId: string) {
    if (!accessToken) throw new Error('Access token is required');

    console.log(`[Microsoft API] Deleting Planner task ${taskId}...`);

    try {
        // Planner requires an E-Tag (If-Match header) to delete a task.
        // We must fetch the task first to get its current E-Tag.
        const taskDetails = await getPlannerTaskDetails(accessToken, taskId);
        const etag = taskDetails['@odata.etag'];

        if (!etag) {
            throw new Error(`Could not find E-Tag for task ${taskId}`);
        }

        const response = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'If-Match': etag
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Microsoft API] Error deleting planner task:', response.status, errorText);
            throw new Error(`Graph API returned ${response.status}: ${errorText}`);
        }

        console.log(`[Microsoft API] Successfully deleted Planner task ${taskId}`);
        return true;
    } catch (error) {
        console.error('[Microsoft API] Failed to delete planner task:', error);
        throw error;
    }
}

/**
 * Update a task in Microsoft Planner
 */
export async function updatePlannerTask(accessToken: string, taskId: string, updateData: any) {
    if (!accessToken) throw new Error('Access token is required');

    console.log(`[Microsoft API] Updating Planner task ${taskId} with data:`, updateData);

    try {
        const taskDetails = await getPlannerTaskDetails(accessToken, taskId);
        const etag = taskDetails['@odata.etag'];

        if (!etag) {
            throw new Error(`Could not find E-Tag for task ${taskId}`);
        }

        // Separate core task properties from detail properties
        const taskUpdate: any = {};
        if (updateData.title !== undefined) taskUpdate.title = updateData.title;
        if (updateData.percentComplete !== undefined) taskUpdate.percentComplete = updateData.percentComplete;
        if (updateData.dueDateTime !== undefined) taskUpdate.dueDateTime = updateData.dueDateTime;

        if (updateData.assigneeIds && updateData.assigneeIds.length > 0) {
            taskUpdate.assignments = {};
            for (const rawUserId of updateData.assigneeIds) {
                const userId = rawUserId.includes('@') ? rawUserId.split('@')[0] : rawUserId;
                taskUpdate.assignments[userId] = {
                    "@odata.type": "#microsoft.graph.plannerAssignment",
                    "orderHint": " !"
                };
            }
        } else if (updateData.assigneeIds && updateData.assigneeIds.length === 0) {
            // Need to remove all assignments?
            // To remove an assignment, you send it with null values or delete from the dict.
            // Better to just not touch if empty unless explicitly managing it.
        }

        // 1. Update Core Task Properties
        if (Object.keys(taskUpdate).length > 0) {
            const response = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'If-Match': etag
                },
                body: JSON.stringify(taskUpdate)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Microsoft API] Error updating planner task:', response.status, errorText);
                throw new Error(`Graph API returned ${response.status}: ${errorText}`);
            }
        }

        // 2. Update Details (Notes, Checklist)
        if (updateData.notes !== undefined || updateData.checklist) {
            try {
                // We need the details E-tag
                const detailsResponse = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (detailsResponse.ok) {
                    const details = await detailsResponse.json();
                    const detailsEtag = details['@odata.etag'];
                    const existingChecklist = details.checklist || {};

                    const detailsUpdate: any = {};
                    if (updateData.notes !== undefined) detailsUpdate.description = updateData.notes;

                    if (updateData.checklist) {
                        detailsUpdate.checklist = {};

                        // Map of existing items by title
                        const existingByTitle = new Map<string, { id: string, isChecked: boolean }>();
                        for (const [key, val] of Object.entries<any>(existingChecklist)) {
                            existingByTitle.set(val.title, { id: key, isChecked: val.isChecked });
                        }

                        updateData.checklist.forEach((itemTitle: string, index: number) => {
                            const existing = existingByTitle.get(itemTitle);
                            if (existing) {
                                // Keep it, remove from map so we don't delete it
                                existingByTitle.delete(itemTitle);
                            } else {
                                // Create new
                                const itemId = `item_${index}_${Math.random().toString(36).substring(7)}`;
                                detailsUpdate.checklist[itemId] = {
                                    '@odata.type': '#microsoft.graph.plannerChecklistItem',
                                    title: itemTitle,
                                    isChecked: false,
                                    orderHint: ' !'
                                };
                            }
                        });

                        // Now everything left in existingByTitle should be deleted
                        for (const { id } of existingByTitle.values()) {
                            detailsUpdate.checklist[id] = null;
                        }
                    }

                    if (Object.keys(detailsUpdate).length > 0) {
                        await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                'If-Match': detailsEtag
                            },
                            body: JSON.stringify(detailsUpdate)
                        });
                        console.log('[Microsoft API] Updated Planner task details (notes/checklist)');
                    }
                }
            } catch (err) {
                console.warn('[Microsoft API] Failed to update task details:', err);
            }
        }

        console.log(`[Microsoft API] Successfully updated Planner task ${taskId}`);
        return { success: true };
    } catch (error) {
        console.error('[Microsoft API] Failed to update planner task:', error);
        throw error;
    }
}

/**
 * Get a calendar event in Microsoft Graph
 */
export async function getMicrosoftEvent(accessToken: string, eventId: string) {
    if (!accessToken) throw new Error('Access token is required');

    console.log(`[Microsoft API] Fetching event ${eventId}...`);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Microsoft API] Error getting event:', response.status, errorText);
        throw new Error(`Graph API returned ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Update a calendar event in Microsoft Graph
 */
export async function updateMicrosoftEvent(accessToken: string, eventId: string, eventDetails: {
    subject?: string;
    body?: string;
    start?: string;
    end?: string;
    attendees?: { email: string; name: string }[];
    isOnlineMeeting?: boolean;
}) {
    if (!accessToken) throw new Error('Access token is required');

    console.log(`[Microsoft API] Updating event ${eventId}...`);

    const updateBody: any = {};
    if (eventDetails.subject !== undefined) updateBody.subject = eventDetails.subject;
    if (eventDetails.body !== undefined) {
        updateBody.body = {
            contentType: 'HTML',
            content: eventDetails.body
        };
    }
    if (eventDetails.start !== undefined) {
        updateBody.start = {
            dateTime: eventDetails.start,
            timeZone: 'UTC'
        };
    }
    if (eventDetails.end !== undefined) {
        updateBody.end = {
            dateTime: eventDetails.end,
            timeZone: 'UTC'
        };
    }
    if (eventDetails.attendees !== undefined) {
        updateBody.attendees = eventDetails.attendees.map(a => ({
            emailAddress: {
                address: a.email,
                name: a.name
            },
            type: 'required'
        }));
    }
    if (eventDetails.isOnlineMeeting !== undefined) {
        updateBody.isOnlineMeeting = eventDetails.isOnlineMeeting;
        updateBody.onlineMeetingProvider = eventDetails.isOnlineMeeting ? 'teamsForBusiness' : undefined;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Microsoft API] Error updating event:', response.status, errorText);
        throw new Error(`Graph API returned ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Delete a calendar event in Microsoft Graph
 */
export async function deleteMicrosoftEvent(accessToken: string, eventId: string) {
    if (!accessToken) throw new Error('Access token is required');

    console.log(`[Microsoft API] Deleting event ${eventId}...`);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.error('[Microsoft API] Error deleting event:', response.status, errorText);
        throw new Error(`Graph API returned ${response.status}: ${errorText}`);
    }

    return true;
}
