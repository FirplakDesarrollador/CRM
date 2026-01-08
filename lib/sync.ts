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
        if (this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;
        useSyncStore.getState().setSyncing(true);
        useSyncStore.getState().setError(null);

        try {
            console.log('[Sync] Starting...');
            await this.pullChanges(); // Pull server data first
            await this.pushChanges(); // Then push local changes
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
            .orderBy('field_timestamp')
            .filter(i => i.status === 'PENDING' || i.status === 'FAILED')
            .limit(50)
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

        // 3. Process batches by priority
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
                    code: err?.code
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
        const { data: { user } } = await supabase.auth.getUser();
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
                await db.accounts.clear();
                await db.accounts.bulkPut(accounts.map((a: any) => ({
                    id: a.id,
                    nombre: a.nombre,
                    nit: a.nit,
                    nit_base: a.nit_base,
                    id_cuenta_principal: a.id_cuenta_principal,
                    telefono: a.telefono,
                    direccion: a.direccion,
                    ciudad: a.ciudad,
                    created_by: a.created_by,
                    updated_by: a.updated_by,
                    updated_at: a.updated_at
                })));
                console.log(`[Sync] Pulled ${accounts.length} accounts.`);
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

            // Pull Opportunities (CRM_Oportunidades)
            const { data: opportunities, error: oppsError } = await supabase
                .from('CRM_Oportunidades')
                .select('*')
                .eq('is_deleted', false);

            if (oppsError) throw oppsError;

            if (opportunities && opportunities.length > 0) {
                await db.opportunities.clear();
                await db.opportunities.bulkPut(opportunities);
                console.log(`[Sync] Pulled ${opportunities.length} opportunities.`);
            }

            // Pull Quotes (CRM_Cotizaciones)
            const { data: quotes, error: quotesError } = await supabase
                .from('CRM_Cotizaciones')
                .select('*')
                .eq('is_deleted', false);

            if (quotesError) throw quotesError;

            if (quotes && quotes.length > 0) {
                await db.quotes.clear();
                await db.quotes.bulkPut(quotes.map((q: any) => ({
                    id: q.id,
                    opportunity_id: q.opportunity_id,
                    numero_cotizacion: q.numero_cotizacion,
                    total_amount: q.total_amount,
                    currency_id: q.currency_id,
                    status: q.status,
                    is_winner: q.is_winner,
                    fecha_minima_requerida: q.fecha_minima_requerida,
                    fecha_facturacion: q.fecha_facturacion,
                    tipo_facturacion: q.tipo_facturacion,
                    notas_sap: q.notas_sap,
                    formas_pago: q.formas_pago,
                    facturacion_electronica: q.facturacion_electronica,
                    created_by: q.created_by,
                    updated_by: q.updated_by,
                    updated_at: q.updated_at
                })));
                console.log(`[Sync] Pulled ${quotes.length} quotes.`);
            }

            // Pull Quote Items (CRM_CotizacionItems)
            const { data: quoteItems, error: itemsError } = await supabase
                .from('CRM_CotizacionItems')
                .select('*')
                .eq('is_deleted', false);

            if (itemsError) throw itemsError;

            if (quoteItems && quoteItems.length > 0) {
                await db.quoteItems.clear();
                await db.quoteItems.bulkPut(quoteItems.map((i: any) => ({
                    id: i.id,
                    cotizacion_id: i.cotizacion_id,
                    producto_id: i.producto_id,
                    cantidad: i.cantidad,
                    precio_unitario: i.precio_unitario,
                    subtotal: i.subtotal,
                    descripcion_linea: i.descripcion_linea,
                    created_by: i.created_by,
                    updated_by: i.updated_by,
                    updated_at: i.updated_at
                })));
                console.log(`[Sync] Pulled ${quoteItems.length} quote items.`);
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
