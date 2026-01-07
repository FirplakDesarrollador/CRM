import { db, OutboxItem } from './db';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { useSyncStore } from './stores/useSyncStore';

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
        if (this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;
        useSyncStore.getState().setSyncing(true);
        useSyncStore.getState().setError(null);

        try {
            console.log('[Sync] Starting...');
            await this.pushChanges();
            // await this.pullChanges(); // To implement
            useSyncStore.getState().setLastSyncTime(new Date().toISOString());
            console.log('[Sync] Completed.');
        } catch (err: any) {
            console.error('[Sync] Failed:', err);
            useSyncStore.getState().setError(err.message);
        } finally {
            this.isSyncing = false;
            useSyncStore.getState().setSyncing(false);
            this.updatePendingCount();
        }
    }

    private async updatePendingCount() {
        const count = await db.outbox.count();
        useSyncStore.getState().setPendingCount(count);
    }

    /**
     * PUSH: Send local mutations to Supabase via RPC
     */
    private async pushChanges() {
        // 1. Get Pending Items
        const pending = await db.outbox
            .where('status')
            .anyOf('PENDING', 'FAILED')
            .limit(50) // Batch size
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

            // Mark as syncing locally
            await db.outbox.update(item.id, { status: 'SYNCING' });
        }

        // 3. Process batches
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn("[Sync] Skipped: No authenticated user.");
            // Reset status of syncing items to PENDING so they are retried later when logged in
            const idsToReset = pending.map(i => i.id);
            await db.outbox.where('id').anyOf(idsToReset).modify({ status: 'PENDING' });
            return;
        }

        for (const [table, updates] of Object.entries(batches)) {
            try {
                const { data, error } = await supabase.rpc('process_field_updates', {
                    p_table_name: table,
                    p_updates: updates,
                    p_user_id: user.id
                });

                if (error) throw error;

                // Handle success responses
                // Assume success for now, delete from outbox
                // In real app, check 'success' flag per item in response 'data'

                // Cleanup Outbox
                const idsToDelete = pending
                    .filter(i => i.entity_type === table)
                    .map(i => i.id);

                await db.outbox.bulkDelete(idsToDelete);

            } catch (err: any) {
                console.error(`[Sync] Error pushing ${table}:`, err?.message || err);
                if (err?.details) console.error(`[Sync] Details:`, err.details);
                if (err?.hint) console.error(`[Sync] Hint:`, err.hint);
                // Revert status to FAILED
                const idsToFail = pending
                    .filter(i => i.entity_type === table)
                    .map(i => i.id);

                await db.outbox.where('id').anyOf(idsToFail).modify({
                    status: 'FAILED',
                    error: err.message,
                    retry_count: 1 // Increment logic needed
                });
            }
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
        const now = Date.now();
        const items: OutboxItem[] = [];

        for (const [field, value] of Object.entries(changes)) {
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

        // Update local mirror immediately (Optimistic UI)
        // await db.table(entityTable).update(entityId, changes); 
        // Note: Needs mapping logic if local table names differ slightly or just generic

        // Trigger Sync lightly
        this.triggerSync();
    }
}

export const syncEngine = new SyncEngine();
