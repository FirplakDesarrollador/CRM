import { db, OutboxItem } from './db';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { useSyncStore } from './stores/useSyncStore';

const TABLE_PRIORITY: Record<string, number> = {
    'CRM_Cuentas': 1,
    'CRM_Contactos': 2,
    'CRM_Oportunidades': 3,
    'CRM_Oportunidades_Colaboradores': 4,
    'CRM_Cotizaciones': 5,
    'CRM_CotizacionItems': 6,
    'CRM_Actividades': 7
};

const MAX_RETRIES = 5;

function getBackoffDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
}

export class SyncEngine {
    private isSyncing = false;

    constructor() {
        // Listen for online status
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.triggerSync());
        }
    }

    /**
     * Main Sync Loop
     */
    async triggerSync() {
        const { isPaused } = useSyncStore.getState();
        if (this.isSyncing || !navigator.onLine || isPaused) return;

        this.isSyncing = true;
        useSyncStore.getState().setSyncing(true);
        useSyncStore.getState().setError(null);

        try {
            console.log('[Sync] Starting...');

            // Authenticate once for the entire sync cycle
            let user;
            try {
                const { data } = await supabase.auth.getUser();
                user = data?.user;
            } catch (e) {
                console.warn("[Sync] Auth unreachable, skipping sync.");
                return;
            }
            if (!user) {
                console.warn("[Sync] No authenticated user, skipping sync.");
                return;
            }

            await this.resetStuckItems(); // Unlock items stuck in 'SYNCING'
            await this.pushChanges(user); // Push local changes FIRST to preserve UX
            await this.pullChanges(user); // Then pull server data (which typically includes our changes now)
            useSyncStore.getState().setLastSyncTime(new Date().toISOString());
            console.log('[Sync] Completed.');
        } catch (err: any) {
            console.error('[Sync] Failed:', err);
            useSyncStore.getState().setError(err.message);
        } finally {
            this.isSyncing = false;
            useSyncStore.getState().setSyncing(false);
            await this.updatePendingCount();

            // Clean up dead items (exceeded max retries)
            try {
                const deadItems = await db.outbox
                    .where('status').equals('FAILED')
                    .filter(i => (i.retry_count || 0) >= MAX_RETRIES)
                    .toArray();

                if (deadItems.length > 0) {
                    console.warn(`[Sync] Removing ${deadItems.length} permanently failed items from outbox:`,
                        deadItems.map(i => `${i.entity_type}.${i.field_name} (entity: ${i.entity_id})`));
                    await db.outbox.bulkDelete(deadItems.map(i => i.id));
                    await this.updatePendingCount();
                }
            } catch (cleanupErr) {
                console.error('[Sync] Failed to clean up dead items:', cleanupErr);
            }

            // Check if more retryable items remain and schedule retry with backoff
            try {
                const remaining = await db.outbox
                    .where('status').anyOf(['PENDING', 'FAILED'])
                    .filter(i => (i.retry_count || 0) < MAX_RETRIES)
                    .toArray();

                if (remaining.length > 0 && navigator.onLine) {
                    const maxRetry = Math.max(0, ...remaining.map(i => i.retry_count || 0));
                    const delay = getBackoffDelay(maxRetry);
                    console.log(`[Sync] ${remaining.length} items still pending (max retry: ${maxRetry}), scheduling retry in ${delay}ms...`);
                    setTimeout(() => this.triggerSync(), delay);
                }
            } catch (retryErr) {
                console.error('[Sync] Failed to check remaining items:', retryErr);
            }
        }
    }

    /**
     * Resets items that were left in 'SYNCING' state (e.g. after a crash)
     */
    private async resetStuckItems() {
        const stuckCount = await db.outbox.where('status').equals('SYNCING').count();
        if (stuckCount > 0) {
            console.log(`[Sync] Resetting ${stuckCount} stuck items to PENDING...`);
            await db.outbox.where('status').equals('SYNCING').modify({ status: 'PENDING' });
        }
    }

    private async updatePendingCount() {
        // Count everything that isn't successfully synced yet
        const count = await db.outbox.where('status').anyOf(['PENDING', 'SYNCING', 'FAILED']).count();
        useSyncStore.getState().setPendingCount(count);
    }

    /**
     * PUSH: Send local mutations to Supabase via RPC
     */
    private async pushChanges(user: any) {
        // 1. Get Pending Items (skip items that exceeded max retries)
        const pending = await db.outbox
            .orderBy('field_timestamp')
            .filter(i => (i.status === 'PENDING' || i.status === 'FAILED') && (i.retry_count || 0) < MAX_RETRIES)
            .limit(500)
            .toArray();

        if (pending.length === 0) return;

        // 2. Group by Table
        const batches: Record<string, any[]> = {};

        for (const item of pending) {
            if (!batches[item.entity_type]) batches[item.entity_type] = [];

            batches[item.entity_type].push({
                id: item.entity_id,
                field: item.field_name,
                value: item.new_value,
                ts: item.field_timestamp
            });
        }

        // Mark all as SYNCING in bulk (single DB transaction instead of N individual updates)
        const pendingIds = pending.map(i => i.id);
        await db.outbox.where('id').anyOf(pendingIds).modify({ status: 'SYNCING' });

        // 3.1 Proactive Fix: Ensure ownership fields are included and valid for critical tables
        // For each entity ID in the batch, if the owner field is missing or invalid (e.g. from mock data), we repair it.
        const now = Date.now();
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const ownershipMap: Record<string, string> = {
            'CRM_Oportunidades': 'owner_user_id',
            'CRM_Actividades': 'user_id',
            'CRM_Cuentas': 'created_by'
        };

        for (const [table, ownerField] of Object.entries(ownershipMap)) {
            if (batches[table]) {
                const idsInBatch = Array.from(new Set(batches[table].map(u => u.id)));

                for (const id of idsInBatch) {
                    // 1. Fix Ownership
                    const ownerEntry = batches[table].find(u => u.id === id && u.field === ownerField);
                    const currentVal = ownerEntry?.value;
                    const isValid = typeof currentVal === 'string' && UUID_REGEX.test(currentVal);

                    if (!isValid) {
                        if (ownerEntry) {
                            ownerEntry.value = user.id;
                        } else {
                            batches[table].push({
                                id: id,
                                field: ownerField,
                                value: user.id,
                                ts: now
                            });
                        }
                    }
                }
            }
        }

        // 3.2 Proactive Fix: Repair invalid fase_id for Opportunities
        // Maps invalid/legacy phase IDs (e.g. 1) to valid ones based on Channel
        if (batches['CRM_Oportunidades']) {
            const updates = batches['CRM_Oportunidades'];
            const faseEntries = updates.filter(u => u.field === 'fase_id');

            if (faseEntries.length > 0) {
                // Fallback Map (derived from server data)
                const PHASE_DEFAULTS: Record<string, number> = {
                    'OBRAS_NAC': 56,
                    'OBRAS_INT': 63,
                    'DIST_NAC': 70,
                    'DIST_INT': 76,
                    'PROPIO': 82
                };

                // Fetch local phases if possible to check validity
                let validPhaseIds = new Set<number>();
                try {
                    const localPhases = await db.phases.toArray();
                    localPhases.forEach(p => validPhaseIds.add(p.id));
                } catch (e) { console.warn("[Sync] Could not read local phases for validation", e); }

                const isValidId = (id: number) => {
                    if (validPhaseIds.size > 0) return validPhaseIds.has(id);
                    return id >= 56;
                };

                for (const entry of faseEntries) {
                    const currentId = Number(entry.value);
                    if (isValidId(currentId)) continue;

                    console.warn(`[Sync] Repairing invalid fase_id ${currentId} for opp ${entry.id}`);

                    // Find channel
                    let channel = 'DIST_NAC'; // default
                    let accountId = updates.find(u => u.id === entry.id && u.field === 'account_id')?.value;

                    if (!accountId) {
                        try {
                            const localOpp = await db.opportunities.get(entry.id);
                            accountId = localOpp?.account_id;
                        } catch (e) { /* ignore */ }
                    }

                    if (accountId) {
                        try {
                            const acc = await db.accounts.get(accountId);
                            if (acc?.canal_id) channel = acc.canal_id;
                        } catch (e) { /* ignore */ }
                    }

                    const fixedId = PHASE_DEFAULTS[channel] || 70; // Default to DIST_NAC (70)
                    entry.value = fixedId;
                    console.log(`[Sync] ...Repaired to ${fixedId} (Channel: ${channel})`);
                }
            }
        }

        // 3.3b Proactive Fix: Filter out non-existent fields for CRM_Actividades
        // After migration 20260218_add_activities_ms_columns.sql, all known fields are now valid.
        // This block is kept as a safety net for future unknown fields.
        if (batches['CRM_Actividades']) {
            const invalidFieldsForActividades: string[] = []; // Add field names here if needed in future
            if (invalidFieldsForActividades.length > 0) {
                batches['CRM_Actividades'] = batches['CRM_Actividades'].filter(update => {
                    if (invalidFieldsForActividades.includes(update.field)) {
                        console.warn(`[Sync] Filtering out invalid field '${update.field}' from CRM_Actividades batch`);
                        db.outbox.filter(i => i.entity_id === update.id && i.field_name === update.field && i.entity_type === 'CRM_Actividades')
                            .delete()
                            .catch(e => console.error("[Sync] Failed to delete filtered item from outbox", e));
                        return false;
                    }
                    return true;
                });
            }

            // 3.3c SELF-HEALING: Validate opportunity_id FK for Activities
            // If the referenced opportunity doesn't exist on the server, set opportunity_id to null
            // to avoid "violates foreign key constraint fk_crmact_opp" errors.
            const actUpdates = batches['CRM_Actividades'];
            const oppIdsFromActivities = new Set<string>();
            actUpdates.forEach(u => {
                if (u.field === 'opportunity_id' && u.value && typeof u.value === 'string') {
                    oppIdsFromActivities.add(u.value);
                }
            });

            // Also check local DB for activities that have opportunity_id but it's not in the batch
            const actEntityIds = Array.from(new Set(actUpdates.map(u => u.id)));
            for (const actId of actEntityIds) {
                const hasOppInBatch = actUpdates.some(u => u.id === actId && u.field === 'opportunity_id');
                if (!hasOppInBatch) {
                    try {
                        const localAct = await db.activities.get(actId);
                        if (localAct?.opportunity_id) oppIdsFromActivities.add(localAct.opportunity_id);
                    } catch (e) { /* ignore */ }
                }
            }

            if (oppIdsFromActivities.size > 0) {
                try {
                    const oppIdsToCheck = Array.from(oppIdsFromActivities);
                    const { data: existingOpps, error: oppCheckErr } = await supabase
                        .from('CRM_Oportunidades')
                        .select('id')
                        .in('id', oppIdsToCheck);

                    if (!oppCheckErr && existingOpps) {
                        const foundOppIds = new Set(existingOpps.map(o => o.id));
                        const missingOppIds = oppIdsToCheck.filter(id => !foundOppIds.has(id));

                        if (missingOppIds.length > 0) {
                            console.warn(`[Sync] Self-healing: Found ${missingOppIds.length} missing opportunities referenced by activities:`, missingOppIds);

                            // Nullify opportunity_id in the batch for activities referencing missing opportunities
                            for (const update of actUpdates) {
                                if (update.field === 'opportunity_id' && missingOppIds.includes(update.value)) {
                                    console.log(`[Sync] Nullifying opportunity_id for activity ${update.id} (missing opp: ${update.value})`);
                                    update.value = null;
                                }
                            }

                            // Also update local Dexie to avoid re-queuing with bad FK
                            for (const actId of actEntityIds) {
                                try {
                                    const localAct = await db.activities.get(actId);
                                    if (localAct?.opportunity_id && missingOppIds.includes(localAct.opportunity_id)) {
                                        await db.activities.update(actId, { opportunity_id: undefined });
                                        console.log(`[Sync] Updated local activity ${actId}: cleared opportunity_id`);
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Sync] Failed to validate opportunity FKs for activities:', e);
                }
            }
        }

        if (batches['CRM_Oportunidades']) {
            const updates = batches['CRM_Oportunidades'];

            // 3.3 Proactive Fix: Filter out non-existent fields for CRM_Oportunidades
            const invalidFieldsForOpp = ['ciudad', 'fase', 'valor', 'items'];
            batches['CRM_Oportunidades'] = batches['CRM_Oportunidades'].filter(update => {
                if (invalidFieldsForOpp.includes(update.field)) {
                    console.warn(`[Sync] Filtering out invalid field '${update.field}' from CRM_Oportunidades batch`);
                    // We delete these from Dexie outbox so they don't keep failing
                    db.outbox.filter(i => i.entity_id === update.id && i.field_name === update.field && i.entity_type === 'CRM_Oportunidades')
                        .delete()
                        .catch(e => console.error("[Sync] Failed to delete filtered item from outbox", e));
                    return false;
                }
                return true;
            });

            // 3.4 SELF-HEALING: Check for missing accounts
            const uniqueAccountIds = new Set<string>();

            // 3.5 Proactive Fix: Filter out incompatible columns for Collaborators if migration pending
            if (batches['CRM_Oportunidades_Colaboradores']) {
                const INVALID_COLLAB_FIELDS = ['created_at', 'updated_at'];
                batches['CRM_Oportunidades_Colaboradores'] = batches['CRM_Oportunidades_Colaboradores'].filter(update => {
                    if (INVALID_COLLAB_FIELDS.includes(update.field)) {
                        console.warn(`[Sync] Filtering out '${update.field}' from CRM_Oportunidades_Colaboradores batch (schema compatibility)`);
                        // Delete from outbox to prevent infinite retry loop
                        db.outbox.filter(i => i.entity_id === update.id && i.field_name === update.field && i.entity_type === 'CRM_Oportunidades_Colaboradores')
                            .delete()
                            .catch(e => console.error("[Sync] Failed to delete filtered item from outbox", e));
                        return false;
                    }
                    return true;
                });
            }

            // Gather account IDs from updates (if present in payload)
            updates.forEach(u => {
                if (u.field === 'account_id' && typeof u.value === 'string') uniqueAccountIds.add(u.value);
            });

            // Also check items in the DB for these opportunities if account_id isn't in the update payload
            const oppIds = Array.from(new Set(updates.map(u => u.id)));
            if (oppIds.length > 0) {
                try {
                    const localOpps = await db.opportunities.where('id').anyOf(oppIds).toArray();
                    localOpps.forEach(o => {
                        if (o.account_id) uniqueAccountIds.add(o.account_id);
                    });
                } catch (e) { console.warn("[Sync] Failed to read local opps for account check", e); }
            }

            if (uniqueAccountIds.size > 0) {
                const accountIdsToCheck = Array.from(uniqueAccountIds);
                // Check server existence (blind check)
                const { data: existingAccounts, error: accCheckErr } = await supabase
                    .from('CRM_Cuentas')
                    .select('id')
                    .in('id', accountIdsToCheck);

                if (!accCheckErr && existingAccounts) {
                    const foundIds = new Set(existingAccounts.map(a => a.id));
                    const missingAccountIds = accountIdsToCheck.filter(id => !foundIds.has(id));

                    if (missingAccountIds.length > 0) {
                        console.warn(`[Sync] Self-healing: Found ${missingAccountIds.length} missing accounts referenced by opportunities.`);

                        const pendingAccounts = await db.outbox
                            .where('entity_type').equals('CRM_Cuentas')
                            .and(i => i.status === 'PENDING' || i.status === 'SYNCING')
                            .toArray();
                        const pendingAccountIds = new Set(pendingAccounts.map(p => p.entity_id));

                        for (const missingId of missingAccountIds) {
                            if (pendingAccountIds.has(missingId)) continue; // Already queueing

                            // Check existence in local DB
                            const localAccount = await db.accounts.get(missingId);
                            if (localAccount) {
                                console.log(`[Sync] Re-queueing missing local account: ${missingId}`);
                                const fieldsToSync: (keyof typeof localAccount)[] =
                                    ['nombre', 'nit', 'nit_base', 'canal_id', 'telefono', 'direccion', 'ciudad_id', 'departamento_id', 'created_by', 'created_at', 'updated_at'];

                                const newOutboxItems: any[] = [];
                                fieldsToSync.forEach(field => {
                                    const val = localAccount[field];
                                    if (val !== undefined && val !== null) {
                                        newOutboxItems.push({
                                            id: uuidv4(),
                                            entity_type: 'CRM_Cuentas',
                                            entity_id: missingId,
                                            field_name: field as string,
                                            old_value: null,
                                            new_value: val,
                                            field_timestamp: now,
                                            status: 'PENDING',
                                            retry_count: 0
                                        });
                                    }
                                });

                                await db.outbox.bulkPut(newOutboxItems);
                            }
                        }
                    }
                }
            }
        }


        // 4. SPECIAL HANDLING: Bypass RPC for CRM_Oportunidades_Colaboradores (Schema mismatch workaround)
        if (batches['CRM_Oportunidades_Colaboradores']) {
            console.log('[Sync] Bypassing RPC for CRM_Oportunidades_Colaboradores...');
            const collabUpdates = batches['CRM_Oportunidades_Colaboradores'];
            delete batches['CRM_Oportunidades_Colaboradores']; // Remove from main RPC loop

            // Group by ID to form rows
            const rowsMap = new Map<string, any>();
            collabUpdates.forEach(u => {
                if (!rowsMap.has(u.id)) rowsMap.set(u.id, {});
                const row = rowsMap.get(u.id);
                // Skip invalid fields here explicitly
                if (!['created_at', 'updated_at'].includes(u.field)) {
                    row[u.field] = u.value;
                }
                row.id = u.id;
            });

            const rows = Array.from(rowsMap.values());

            // Enrichment: Ensure all required fields exist for new/missing server rows
            // This is critical for CRM_Oportunidades_Colaboradores because it has NOT NULL and CHECK constraints.
            if (rows.length > 0) {
                const isValidUUID = (id: any) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

                for (let i = rows.length - 1; i >= 0; i--) {
                    const row = rows[i];
                    try {
                        const localItem = await db.opportunityCollaborators.get(row.id);
                        if (localItem) {
                            if (!row.oportunidad_id) row.oportunidad_id = localItem.oportunidad_id;
                            if (!row.usuario_id) row.usuario_id = localItem.usuario_id;
                            if (row.porcentaje === undefined) row.porcentaje = localItem.porcentaje;
                            if (!row.rol) row.rol = localItem.rol;

                            // Proactive Fix: Some items might have percentage 0 or null causing constraint violations
                            if (row.porcentaje === null || row.porcentaje === undefined || row.porcentaje <= 0) {
                                console.warn(`[Sync] Repairing invalid percentage ${row.porcentaje} for collab ${row.id}`);
                                row.porcentaje = 0.01; // Minimum valid percentage
                            }
                        }

                        // CRITICAL: Validate UUIDs to prevent infinite 400 loops
                        if (!isValidUUID(row.usuario_id) || !isValidUUID(row.oportunidad_id)) {
                            console.error(`[Sync] Invalid UUIDs for collaborator sync. User: ${row.usuario_id}, Opp: ${row.oportunidad_id}. Row:`, row);

                            // Remove this row from the batch to prevent failure
                            rows.splice(i, 1);

                            // Delete the Bad Item from Outbox to stop the loop
                            const badItems = pending.filter(p => p.entity_id === row.id && p.entity_type === 'CRM_Oportunidades_Colaboradores');
                            if (badItems.length > 0) {
                                console.warn(`[Sync] Deleting ${badItems.length} malformed collaborator items from outbox to break loop.`);
                                await db.outbox.bulkDelete(badItems.map(b => b.id));
                            }
                        }

                    } catch (e) {
                        console.error("[Sync] Error preparing collaborator row:", e);
                    }
                }
            }

            if (rows.length > 0) {
                console.log('[Sync] Bypass Rows Preview:', JSON.stringify(rows, null, 2));
                try {
                    const { error } = await supabase.from('CRM_Oportunidades_Colaboradores').upsert(rows);

                    if (!error) {
                        const rowIds = rows.map(r => r.id);
                        const idsToDelete = pending
                            .filter(p => p.entity_type === 'CRM_Oportunidades_Colaboradores' && rowIds.includes(p.entity_id))
                            .map(p => p.id);

                        if (idsToDelete.length > 0) {
                            await db.outbox.bulkDelete(idsToDelete);
                        }
                        console.log(`[Sync] Bypassed RPC for Collaborators. Synced ${rows.length} rows.`);
                    } else {
                        console.error('[Sync] Collaborator bypass failed:', error);
                        // Mark as failed in outbox
                        const idsToFail = collabUpdates.map(u => pending.find(p => p.entity_id === u.id && p.field_name === u.field && p.entity_type === 'CRM_Oportunidades_Colaboradores')?.id).filter(Boolean) as string[];
                        if (idsToFail.length > 0) {
                            await db.outbox.where('id').anyOf(idsToFail).modify({
                                status: 'FAILED',
                                error: error.message,
                                retry_count: 1 // Increment? Or just set?
                            });
                        }
                    }
                } catch (e: any) {
                    console.error('[Sync] Collaborator bypass exception:', e);
                }
            }
        }

        const sortedTables = Object.entries(batches).sort(([tableA], [tableB]) => {
            const priorityA = TABLE_PRIORITY[tableA] || 99;
            const priorityB = TABLE_PRIORITY[tableB] || 99;
            return priorityA - priorityB;
        });

        for (const [table, updates] of sortedTables) {
            try {
                const { data, error } = await supabase.rpc('process_field_updates', {
                    p_table_name: table,
                    p_updates: updates,
                    p_user_id: user.id
                });

                if (error) {
                    console.error(`[Sync] RPC Fatal Error for ${table}:`, error.message);
                    throw error; // This jumps to the catch block for the whole table
                }

                // Process individual results
                const results = data as any[];
                console.log(`[Sync] Processed ${updates.length} updates for ${table}. ${results.filter(r => r.success).length} success, ${results.filter(r => !r.success).length} failed.`);

                for (const result of results) {
                    if (result.success) {
                        if (result.field === '_all') {
                            // Successful INSERT (or consolidated update): remove ALL pending items for this ID
                            const idsToDelete = pending
                                .filter(p => p.entity_id === result.id && p.entity_type === table)
                                .map(p => p.id);
                            await db.outbox.bulkDelete(idsToDelete);
                        } else {
                            // Successful single field update: remove ALL items for this field from outbox in this batch
                            const idsToDelete = pending
                                .filter(p => p.entity_id === result.id && p.field_name === result.field && p.entity_type === table)
                                .map(p => p.id);
                            await db.outbox.bulkDelete(idsToDelete);
                        }
                    } else {
                        // Failure: Mark ALL relevant items as FAILED
                        const itemsToFail = result.field === '_all'
                            ? pending.filter(p => p.entity_id === result.id && p.entity_type === table)
                            : pending.filter(p => p.entity_id === result.id && p.field_name === result.field && p.entity_type === table);

                        await db.transaction('rw', db.outbox, async () => {
                            for (const item of itemsToFail) {
                                console.warn(`[Sync] Push failed for ${table}.${item.field_name}: ${result.message}`);
                                await db.outbox.update(item.id, {
                                    status: 'FAILED',
                                    error: result.message,
                                    retry_count: (item.retry_count || 0) + 1
                                });
                            }
                        });
                    }
                }

            } catch (err: any) {
                console.error(`[Sync] Table sweep failure for ${table}:`, err.message);
                // Revert status to FAILED for remaining items in this table batch that were marked as SYNCING
                const idsToFail = pending
                    .filter(i => i.entity_type === table)
                    .map(i => i.id);

                await db.outbox.where('id').anyOf(idsToFail).modify({
                    status: 'FAILED',
                    error: err.message
                });

                // BREAK ON FATAL: Prevent processing child tables if parent has a fatal RPC error
                console.warn(`[Sync] Breaking sync loop due to fatal failure in ${table}.`);
                break;
            }
        }
    }

    /**
     * PULL: Download server data to local IndexedDB
     * Called on app initialization to ensure all browsers have the same data
     */
    private async pullChanges(_user: any) {
        console.log('[Sync] Pulling data from server...');

        try {
            // Pull Accounts (CRM_Cuentas)
            // PERF OPTIMIZATION: Disable full sync.
            /*
            // Pull Accounts (CRM_Cuentas)
            // PERF OPTIMIZATION: Full sync enabled to ensure filter consistency
            const { data: accounts, error: accountsError } = await supabase
                .from('CRM_Cuentas')
                .select('*')
                .eq('is_deleted', false);
    
            if (accountsError) throw accountsError;
    
            if (accounts && accounts.length > 0) {
                const pendingAccountIds = new Set(
                    (await db.outbox
                        .where('entity_type').equals('CRM_Cuentas')
                        .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                        .toArray()
                    ).map(item => item.entity_id)
                );
    
                let mergedCount = 0;
                let skippedCount = 0;
    
                for (const a of accounts) {
                    if (pendingAccountIds.has(a.id)) {
                        skippedCount++;
                        continue;
                    }
    
                    await db.accounts.put({
                        id: a.id,
                        nombre: a.nombre,
                        nit: a.nit,
                        nit_base: a.nit_base,
                        id_cuenta_principal: a.id_cuenta_principal,
                        canal_id: a.canal_id || 'DIST_NAC',
                        es_premium: a.es_premium ?? false,
                        telefono: a.telefono,
                        direccion: a.direccion,
                        ciudad: a.ciudad,
                        created_by: a.created_by,
                        updated_by: a.updated_by,
                        updated_at: a.updated_at
                    });
                    mergedCount++;
                }
                console.log(`[Sync] Merged ${mergedCount} accounts (${skippedCount} with pending changes skipped).`);
            }

            // Pull Phases (CRM_FasesOportunidad)
            try {
                const { data: phases, error: phasesError } = await supabase
                    .from('CRM_FasesOportunidad')
                    .select('*')
                    .eq('is_active', true);

                if (phasesError) throw phasesError;

                if (phases && phases.length > 0) {
                    const mapped = phases.map((f: any) => ({
                        id: f.id,
                        nombre: f.nombre,
                        orden: f.orden,
                        is_active: f.is_active,
                        canal_id: f.canal_id,
                        probability: f.probability ?? 0
                    }));
                    await db.transaction('rw', db.phases, async () => {
                        await db.phases.clear();
                        await db.phases.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${phases.length} phases.`);
                }
            } catch (pErr: any) {
                console.error('[Sync] Failed to pull phases:', pErr.message);
            }

            // Pull Subclassifications (CRM_Subclasificacion)
            try {
                const { data: subs, error: subsError } = await supabase
                    .from('CRM_Subclasificacion')
                    .select('*');

                if (subsError) throw subsError;

                if (subs && subs.length > 0) {
                    const mapped = subs.map((s: any) => ({
                        id: s.id,
                        nombre: s.nombre,
                        canal_id: s.canal_id
                    }));
                    await db.transaction('rw', db.subclasificaciones, async () => {
                        await db.subclasificaciones.clear();
                        await db.subclasificaciones.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${subs.length} subclassifications.`);
                }
            } catch (sErr: any) {
                console.error('[Sync] Failed to pull subclassifications:', sErr.message);
            }

            // Pull Activity Classifications
            try {
                const { data: actCls, error: actClsError } = await supabase
                    .from('CRM_Activity_Clasificacion')
                    .select('*');

                if (actClsError) throw actClsError;

                if (actCls && actCls.length > 0) {
                    const mapped = actCls.map((c: any) => ({
                        id: c.id,
                        nombre: c.nombre,
                        tipo_actividad: c.tipo_actividad
                    }));
                    await db.transaction('rw', db.activityClassifications, async () => {
                        await db.activityClassifications.clear();
                        await db.activityClassifications.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${actCls.length} activity classifications.`);
                }
            } catch (acErr: any) {
                console.error('[Sync] Failed to pull activity classifications:', acErr.message);
            }

            // Pull Activity Subclassifications
            try {
                const { data: actSubs, error: actSubsError } = await supabase
                    .from('CRM_Activity_Subclasificacion')
                    .select('*');

                if (actSubsError) throw actSubsError;

                if (actSubs && actSubs.length > 0) {
                    const mapped = actSubs.map((s: any) => ({
                        id: s.id,
                        nombre: s.nombre,
                        clasificacion_id: s.clasificacion_id
                    }));
                    await db.transaction('rw', db.activitySubclassifications, async () => {
                        await db.activitySubclassifications.clear();
                        await db.activitySubclassifications.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${actSubs.length} activity subclassifications.`);
                }
            } catch (asErr: any) {
                console.error('[Sync] Failed to pull activity subclassifications:', asErr.message);
            }

            // Pull Segments (CRM_Segmentos)
            try {
                const { data: segments, error: segmentsError } = await supabase
                    .from('CRM_Segmentos')
                    .select('*');

                if (segmentsError) throw segmentsError;

                if (segments && segments.length > 0) {
                    const mapped = segments.map((s: any) => ({
                        id: s.id,
                        nombre: s.nombre,
                        subclasificacion_id: s.subclasificacion_id
                    }));
                    await db.transaction('rw', db.segments, async () => {
                        await db.segments.clear();
                        await db.segments.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${segments.length} segments.`);
                }
            } catch (segErr: any) {
                console.error('[Sync] Failed to pull segments:', segErr.message);
            }

            // Pull Departments (CRM_Departamentos)
            try {
                const { data: deps, error: depsError } = await supabase
                    .from('CRM_Departamentos')
                    .select('*');

                if (depsError) throw depsError;

                if (deps && deps.length > 0) {
                    const mapped = deps.map((d: any) => ({
                        id: d.id,
                        nombre: d.nombre
                    }));
                    await db.transaction('rw', db.departments, async () => {
                        await db.departments.clear();
                        await db.departments.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${deps.length} departments.`);
                }
            } catch (depErr: any) {
                console.error('[Sync] Failed to pull departments:', depErr.message);
            }

            // Pull Cities (CRM_Ciudades)
            try {
                const { data: cities, error: citiesError } = await supabase
                    .from('CRM_Ciudades')
                    .select('*');

                if (citiesError) throw citiesError;

                if (cities && cities.length > 0) {
                    const mapped = cities.map((c: any) => ({
                        id: c.id,
                        departamento_id: c.departamento_id,
                        nombre: c.nombre
                    }));
                    await db.transaction('rw', db.cities, async () => {
                        await db.cities.clear();
                        await db.cities.bulkPut(mapped);
                    });
                    console.log(`[Sync] Pulled ${cities.length} cities.`);
                }
            } catch (cityErr: any) {
                console.error('[Sync] Failed to pull cities:', cityErr.message);
            }

            // Pull Contacts (CRM_Contactos) - SMART MERGE
            // PERF OPTIMIZATION: Full sync enabled
            const { data: contacts, error: contactsError } = await supabase
                .from('CRM_Contactos')
                .select('*')
                .eq('is_deleted', false);
    
            if (contactsError) throw contactsError;
    
            if (contacts && contacts.length > 0) {
                const pendingContactIds = new Set(
                    (await db.outbox
                        .where('entity_type').equals('CRM_Contactos')
                        .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                        .toArray()
                    ).map(item => item.entity_id)
                );
    
                let mergedCount = 0;
                let skippedCount = 0;
    
                for (const c of contacts) {
                    if (pendingContactIds.has(c.id)) {
                        skippedCount++;
                        continue;
                    }
                    await db.contacts.put({
                        id: c.id,
                        account_id: c.account_id,
                        nombre: c.nombre,
                        cargo: c.cargo,
                        email: c.email,
                        telefono: c.telefono,
                        es_principal: c.es_principal,
                        created_by: c.created_by,
                        updated_by: c.updated_by,
                        updated_at: c.updated_at
                    });
                    mergedCount++;
                }
                console.log(`[Sync] Merged ${mergedCount} contacts (${skippedCount} with pending changes skipped).`);
            }

            // Pull Opportunities (CRM_Oportunidades) - SMART MERGE
            // PERF OPTIMIZATION: Full sync enabled
            console.log('[Sync] Starting Opportunity Pull...');
            const { data: opportunities, error: oppsError } = await supabase
                .from('CRM_Oportunidades')
                .select('*')
                .eq('is_deleted', false);
    
            if (oppsError) {
                console.error('[Sync] Error pulling opportunities:', oppsError);
                throw oppsError;
            }

            console.log(`[Sync] Pulled ${opportunities?.length || 0} opportunities from server.`);
    
            if (opportunities && opportunities.length > 0) {
                const pendingOppIds = new Set(
                    (await db.outbox
                        .where('entity_type').equals('CRM_Oportunidades')
                        .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                        .toArray()
                    ).map(item => item.entity_id)
                );
    
                let mergedCount = 0;
                let skippedCount = 0;
    
                for (const opp of opportunities) {
                    if (pendingOppIds.has(opp.id)) {
                        skippedCount++;
                        continue;
                    }
                    await db.opportunities.put(opp);
                    mergedCount++;
                }
                console.log(`[Sync] Merged ${mergedCount} opportunities (${skippedCount} with pending changes skipped).`);
            } else {
                console.warn('[Sync] No opportunities returned from server (Length is 0 or undefined). Check RLS policies?');
            }

            // Pull Quotes (CRM_Cotizaciones) - SMART MERGE
            // PERF OPTIMIZATION: Disable full sync.
            /*
            const { data: quotes, error: quotesError } = await supabase
                .from('CRM_Cotizaciones')
                .select('*')
                .eq('is_deleted', false);
    
            if (quotesError) throw quotesError;
    
            if (quotes && quotes.length > 0) {
                const pendingQuoteIds = new Set(
                    (await db.outbox
                        .where('entity_type').equals('CRM_Cotizaciones')
                        .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                        .toArray()
                    ).map(item => item.entity_id)
                );
    
                let mergedCount = 0;
                let skippedCount = 0;
    
                for (const q of quotes) {
                    if (pendingQuoteIds.has(q.id)) {
                        skippedCount++;
                        continue;
                    }
    
                    await db.quotes.put({
                        id: q.id,
                        opportunity_id: q.opportunity_id,
                        numero_cotizacion: q.numero_cotizacion,
                        total_amount: q.total_amount,
                        currency_id: q.currency_id,
                        status: q.status,
                        is_winner: q.is_winner,
                        es_pedido: q.es_pedido,
                        fecha_minima_requerida: q.fecha_minima_requerida,
                        fecha_facturacion: q.fecha_facturacion,
                        tipo_facturacion: q.tipo_facturacion,
                        notas_sap: q.notas_sap,
                        formas_pago: q.formas_pago,
                        facturacion_electronica: q.facturacion_electronica,
                        orden_compra: q.orden_compra,
                        incoterm: q.incoterm,
                        created_by: q.created_by,
                        updated_by: q.updated_by,
                        updated_at: q.updated_at
                    });
                    mergedCount++;
                }
                console.log(`[Sync] Merged ${mergedCount} quotes (${skippedCount} with pending changes skipped).`);
            }
            */

            // PERF OPTIMIZATION: Disable full sync for CRM_CotizacionItems
            // Quote items are loaded on-demand when viewing a specific quote
            // This dramatically improves app startup time
            /*
            const { data: quoteItems, error: itemsError } = await supabase
                .from('CRM_CotizacionItems')
                .select('*')
                .eq('is_deleted', false);
    
            if (itemsError) throw itemsError;
    
            if (quoteItems && quoteItems.length > 0) {
                const pendingItemIds = new Set(
                    (await db.outbox
                        .where('entity_type').equals('CRM_CotizacionItems')
                        .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                        .toArray()
                    ).map(item => item.entity_id)
                );
    
                let mergedCount = 0;
                let skippedCount = 0;
    
                for (const i of quoteItems) {
                    if (pendingItemIds.has(i.id)) {
                        skippedCount++;
                        continue;
                    }
    
                    await db.quoteItems.put({
                        id: i.id,
                        cotizacion_id: i.cotizacion_id,
                        producto_id: i.producto_id,
                        cantidad: i.cantidad,
                        precio_unitario: i.precio_unitario,
                        discount_pct: i.discount_pct,
                        max_discount_pct: i.max_discount_pct,
                        final_unit_price: i.final_unit_price,
                        subtotal: i.subtotal,
                        descripcion_linea: i.descripcion_linea,
                        created_by: i.created_by,
                        updated_by: i.updated_by,
                        updated_at: i.updated_at
                    });
                    mergedCount++;
                }
                console.log(`[Sync] Merged ${mergedCount} quote items (${skippedCount} with pending changes skipped).`);
            }
            */

            // Pull Activities (CRM_Actividades) - SMART MERGE with incremental sync
            // Re-enabled to ensure activities persist across browser sessions
            try {
                const lastSync = useSyncStore.getState().lastSyncTime;

                let query = supabase
                    .from('CRM_Actividades')
                    .select('*')
                    .eq('is_deleted', false);

                // Incremental: only pull activities updated since last sync
                if (lastSync) {
                    query = query.gte('updated_at', lastSync);
                }

                const { data: activities, error: activitiesError } = await query;

                if (activitiesError) throw activitiesError;

                if (activities && activities.length > 0) {
                    // Smart merge: Skip records with pending changes
                    const pendingActivityIds = new Set(
                        (await db.outbox
                            .where('entity_type').equals('CRM_Actividades')
                            .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                            .toArray()
                        ).map(item => item.entity_id)
                    );

                    const activitiesToMerge = activities.filter(a => !pendingActivityIds.has(a.id));
                    const skippedCount = activities.length - activitiesToMerge.length;

                    if (activitiesToMerge.length > 0) {
                        await db.activities.bulkPut(activitiesToMerge);
                    }

                    console.log(`[Sync] Merged ${activitiesToMerge.length} activities (${skippedCount} with pending changes skipped).`);
                }
            } catch (actErr: any) {
                console.error('[Sync] Failed to pull activities:', actErr.message);
            }

            console.log('[Sync] Pull completed successfully.');
        } catch (err: any) {
            console.error('[Sync] Pull failed:', err.message);
            // Don't throw - allow push to continue even if pull fails
        }
    }

    /**
     * QUEUE MUTATION: App calls this to save data
     */
    async queueMutation(
        entityTable: string,
        entityId: string,
        changes: Record<string, any>
    ) {
        try {
            const now = Date.now();
            const items: OutboxItem[] = [];

            for (const [field, value] of Object.entries(changes)) {
                if (value === undefined) continue; // Skip undefined fields
                if (field === '_sync_metadata') continue; // Skip sync metadata
                if (field === 'id') continue; // Skip ID (it's the key, not a field to update)

                items.push({
                    id: uuidv4(),
                    entity_type: entityTable,
                    entity_id: entityId,
                    field_name: field,
                    old_value: null, // Optional tracking
                    new_value: value,
                    field_timestamp: now,
                    status: 'PENDING',
                    retry_count: 0
                });
            }

            await db.outbox.bulkAdd(items);
            this.updatePendingCount();

            // Trigger Sync in background (non-blocking for immediate local UI feedback)
            this.triggerSync().catch(err => {
                console.warn('[Sync] Background sync triggered from mutation failed:', err);
            });
        } catch (err) {
            console.error('[Sync] Failed to queue mutation:', err);
        }
    }
    async getCurrentUser() {
        return await supabase.auth.getUser();
    }
}

export const syncEngine = new SyncEngine();
