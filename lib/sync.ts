import { db, OutboxItem } from './db';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { useSyncStore } from './stores/useSyncStore';

const TABLE_PRIORITY: Record<string, number> = {
    'CRM_Cuentas': 1,
    'CRM_Contactos': 2,
    'CRM_Oportunidades': 3,
    'CRM_Cotizaciones': 4,
    'CRM_CotizacionItems': 5,
    'CRM_Actividades': 6
};

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
            await this.resetStuckItems(); // Unlock items stuck in 'SYNCING'
            await this.pushChanges(); // Push local changes FIRST to preserve UX
            await this.pullChanges(); // Then pull server data (which typically includes our changes now)
            useSyncStore.getState().setLastSyncTime(new Date().toISOString());
            console.log('[Sync] Completed.');
        } catch (err: any) {
            console.error('[Sync] Failed:', err);
            useSyncStore.getState().setError(err.message);
        } finally {
            this.isSyncing = false;
            useSyncStore.getState().setSyncing(false);
            await this.updatePendingCount();

            // Check if more items arrived during sync and retry
            const remainingCount = await db.outbox.where('status').anyOf(['PENDING', 'FAILED']).count();
            if (remainingCount > 0 && navigator.onLine) {
                console.log(`[Sync] ${remainingCount} items still pending, scheduling retry...`);
                setTimeout(() => this.triggerSync(), 1000);
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
        const count = await db.outbox.count();
        useSyncStore.getState().setPendingCount(count);
    }

    /**
     * PUSH: Send local mutations to Supabase via RPC
     */
    private async pushChanges() {
        // 1. Get Pending Items
        const pending = await db.outbox
            .orderBy('field_timestamp')
            .filter(i => i.status === 'PENDING' || i.status === 'FAILED')
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

            // Mark as syncing locally
            await db.outbox.update(item.id, { status: 'SYNCING' });
        }

        // 3. Process batches
        let user;
        try {
            const { data } = await supabase.auth.getUser();
            user = data?.user;
        } catch (e) {
            console.warn("[Sync] Push skipped: Auth unreachable or network issue.");
            const idsToReset = pending.map(i => i.id);
            await db.outbox.where('id').anyOf(idsToReset).modify({ status: 'PENDING' });
            return;
        }

        if (!user) {
            console.warn("[Sync] Push skipped: No authenticated user.");
            const idsToReset = pending.map(i => i.id);
            await db.outbox.where('id').anyOf(idsToReset).modify({ status: 'PENDING' });
            return;
        }

        // 3.1 Proactive Fix: Ensure ownership fields are included and valid for critical tables
        // For each entity ID in the batch, if the owner field is missing or invalid (e.g. from mock data), we repair it.
        const now = Date.now();
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const ownershipMap: Record<string, string> = {
            'CRM_Oportunidades': 'owner_user_id',
            'CRM_Actividades': 'user_id'
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

                    // 2. Fix Mandatory Fields for Activities (asunto)
                    if (table === 'CRM_Actividades') {
                        const asuntoEntry = batches[table].find(u => u.id === id && u.field === 'asunto');
                        if (!asuntoEntry || !asuntoEntry.value) {
                            if (asuntoEntry) {
                                asuntoEntry.value = 'Nueva Actividad (Sync Repair)';
                            } else {
                                batches[table].push({
                                    id: id,
                                    field: 'asunto',
                                    value: 'Nueva Actividad (Sync Repair)',
                                    ts: now
                                });
                            }
                        }
                    }
                }
            }
        }


        // 3.3 Process batches by priority
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
                    console.error(`[Sync] RPC Error for ${table}:`, error.message, error.details, error.hint);
                    throw error;
                }

                console.log(`[Sync] Successfully pushed ${updates.length} updates for ${table}`);

                // Cleanup Outbox
                const idsToDelete = pending
                    .filter(i => i.entity_type === table)
                    .map(i => i.id);

                await db.outbox.bulkDelete(idsToDelete);

            } catch (err: any) {
                console.error(`[Sync] Fatal error pushing ${table}:`, {
                    message: err?.message || err,
                    details: err?.details,
                    hint: err?.hint,
                    code: err?.code,
                    updates_sample: updates.slice(0, 2)
                });
                // Revert status to FAILED
                const idsToFail = pending
                    .filter(i => i.entity_type === table)
                    .map(i => i.id);

                await db.outbox.where('id').anyOf(idsToFail).modify({
                    status: 'FAILED',
                    error: err.message,
                    retry_count: 1 // Increment logic needed
                });

                // BREAK ON FAILURE: Prevent processing child tables if parent fails
                console.warn(`[Sync] Breaking sync loop due to failure in ${table}. FK violations prevented.`);
                break;
            }
        }
    }

    /**
     * PULL: Download server data to local IndexedDB
     * Called on app initialization to ensure all browsers have the same data
     */
    private async pullChanges() {
        let user;
        try {
            const { data } = await supabase.auth.getUser();
            user = data?.user;
        } catch (e) {
            console.warn("[Sync] Pull skipped: Auth unreachable or network issue.");
            return;
        }

        if (!user) {
            console.warn("[Sync] Pull skipped: No authenticated user.");
            return;
        }

        console.log('[Sync] Pulling data from server...');

        try {
            // Pull Accounts (CRM_Cuentas)
            const { data: accounts, error: accountsError } = await supabase
                .from('CRM_Cuentas')
                .select('*')
                .eq('is_deleted', false);

            if (accountsError) throw accountsError;

            if (accounts && accounts.length > 0) {
                // Get all pending entity IDs for this table
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
            const { data: phases, error: phasesError } = await supabase
                .from('CRM_FasesOportunidad')
                .select('*')
                .eq('is_active', true);

            if (phasesError) throw phasesError;

            if (phases && phases.length > 0) {
                await db.phases.clear();
                await db.phases.bulkPut(phases.map((f: any) => ({
                    id: f.id,
                    nombre: f.nombre,
                    orden: f.orden,
                    is_active: f.is_active,
                    canal_id: f.canal_id
                })));
                console.log(`[Sync] Pulled ${phases.length} phases.`);
            }

            // Pull Contacts (CRM_Contactos)
            const { data: contacts, error: contactsError } = await supabase
                .from('CRM_Contactos')
                .select('*')
                .eq('is_deleted', false);

            if (contactsError) throw contactsError;

            if (contacts && contacts.length > 0) {
                await db.contacts.clear();
                await db.contacts.bulkPut(contacts.map((c: any) => ({
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
                })));
                console.log(`[Sync] Pulled ${contacts.length} contacts.`);
            }

            // Pull Opportunities (CRM_Oportunidades) - SMART MERGE
            const { data: opportunities, error: oppsError } = await supabase
                .from('CRM_Oportunidades')
                .select('*')
                .eq('is_deleted', false);

            if (oppsError) throw oppsError;

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
            }

            // Pull Quotes (CRM_Cotizaciones) - SMART MERGE
            const { data: quotes, error: quotesError } = await supabase
                .from('CRM_Cotizaciones')
                .select('*')
                .eq('is_deleted', false);

            if (quotesError) throw quotesError;

            if (quotes && quotes.length > 0) {
                // Get all pending entity IDs for this table
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
                        continue; // Skip - local has pending changes
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

            // Pull Quote Items (CRM_CotizacionItems) - SMART MERGE
            const { data: quoteItems, error: itemsError } = await supabase
                .from('CRM_CotizacionItems')
                .select('*')
                .eq('is_deleted', false);

            if (itemsError) throw itemsError;

            if (quoteItems && quoteItems.length > 0) {
                // Get all pending entity IDs for this table
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
                        continue; // Skip - local has pending changes
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

            // Pull Activities (CRM_Actividades)
            const { data: activities, error: activitiesError } = await supabase
                .from('CRM_Actividades')
                .select('*')
                .eq('is_deleted', false);

            if (activitiesError) throw activitiesError;

            if (activities && activities.length > 0) {
                await db.activities.clear();
                await db.activities.bulkPut(activities);
                console.log(`[Sync] Pulled ${activities.length} activities.`);
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
        const now = Date.now();
        const items: OutboxItem[] = [];

        for (const [field, value] of Object.entries(changes)) {
            if (value === undefined) continue; // Skip undefined fields
            if (field === '_sync_metadata') continue; // Skip sync metadata

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
    async getCurrentUser() {
        return await supabase.auth.getUser();
    }
}

export const syncEngine = new SyncEngine();
