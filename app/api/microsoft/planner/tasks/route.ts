import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createPlannerTask, getMicrosoftTokens } from '@/lib/microsoft';

export async function POST(request: NextRequest) {
    console.log('[API Planner Tasks] POST request received');

    try {
        const body = await request.json();
        const { planId, bucketId, title, dueDateTime, assigneeIds, notes, checklist } = body;

        console.log('[API Planner Tasks] Body:', { planId, bucketId, title, checklistCount: checklist?.length, assigneesCount: assigneeIds?.length });

        if (!title) {
            return NextResponse.json(
                { error: 'title is required' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user) {
            console.log('[API Planner Tasks] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Microsoft tokens
        const tokens = await getMicrosoftTokens(user.id, supabase);
        if (!tokens || !tokens.access_token) {
            console.log('[API Planner Tasks] No Microsoft tokens found');
            return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 400 });
        }

        // ALWAYS add the current user (creator) to assignees, plus any collaborators selected
        let finalAssigneeIds = [...(assigneeIds || [])];
        try {
            console.log('[API Planner Tasks] Fetching current user Microsoft ID to add as assignee...');
            const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });

            if (meResponse.ok) {
                const meData = await meResponse.json();
                if (meData.id) {
                    // Add creator at the beginning if not already in the list
                    if (!finalAssigneeIds.includes(meData.id)) {
                        finalAssigneeIds.unshift(meData.id);
                        console.log('[API Planner Tasks] Added creator as assignee:', meData.displayName, meData.id);
                    }
                }
            } else {
                console.warn('[API Planner Tasks] Could not fetch current user Microsoft ID');
            }
        } catch (meError) {
            console.error('[API Planner Tasks] Error fetching current user:', meError);
            // Continue with just the provided assignees
        }

        let finalPlanId = planId;
        let finalBucketId = bucketId;

        // Auto-discover "CRM Ventas" plan and "Proyecto CRM" bucket if not provided
        if (!finalPlanId || !finalBucketId) {
            try {
                console.log('[API Planner Tasks] Missing planId or bucketId. Attempting auto-discovery...');
                // 1. Get Group
                const groupRes = await fetch('https://graph.microsoft.com/v1.0/groups?$filter=displayName eq \'CRM Ventas\'', {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                if (groupRes.ok) {
                    const groupData = await groupRes.json();
                    if (groupData.value && groupData.value.length > 0) {
                        const groupId = groupData.value[0].id;

                        // 2. Get Plan
                        if (!finalPlanId) {
                            const plansRes = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/planner/plans`, {
                                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                            });
                            if (plansRes.ok) {
                                const plansData = await plansRes.json();
                                const crmPlan = plansData.value?.find((p: any) => p.title === 'CRM Ventas') || plansData.value?.[0];
                                if (crmPlan) finalPlanId = crmPlan.id;
                            }
                        }

                        // 3. Get Bucket
                        if (finalPlanId && !finalBucketId) {
                            const bucketRes = await fetch(`https://graph.microsoft.com/v1.0/planner/plans/${finalPlanId}/buckets`, {
                                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                            });
                            if (bucketRes.ok) {
                                const bucketData = await bucketRes.json();
                                const crmBucket = bucketData.value?.find((b: any) => b.name === 'Proyecto CRM') || bucketData.value?.[0];
                                if (crmBucket) finalBucketId = crmBucket.id;
                            }
                        }
                    }
                }

                console.log('[API Planner Tasks] Auto-discovery results:', { finalPlanId, finalBucketId });
            } catch (autoDiscErr) {
                console.error('[API Planner Tasks] Error during auto-discovery:', autoDiscErr);
            }
        }

        if (!finalPlanId || !finalBucketId) {
            return NextResponse.json(
                { error: 'Could not auto-discover or missing planId/bucketId.' },
                { status: 400 }
            );
        }

        console.log('[API Planner Tasks] Creating task in Planner with assignees:', finalAssigneeIds.length);
        const task = await createPlannerTask(tokens.access_token, {
            planId: finalPlanId,
            bucketId: finalBucketId,
            title,
            dueDateTime,
            assigneeIds: finalAssigneeIds,
            notes,
            checklist
        });

        console.log('[API Planner Tasks] Task created:', task?.id);
        return NextResponse.json({ task });
    } catch (error: any) {
        console.error('[API Planner Tasks] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
