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
            'CRM_Actividades': 'user_id',
            'CRM_Cuentas': 'created_by'
        };

        for (const [table, ownerField] of Object.entries(ownershipMap)) {
            if (batches[table]) {
                const idsInBatch = Array.from(new Set(batches[table].map(u => u.id)));

                // CRM_Cuentas Specific Debugging
                if (table === 'CRM_Cuentas') {
                    console.log('[Sync] CRITICAL DEBUG - Account Batch detected:', batches[table]);
                }

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
                    // REMOVED: This logic was too aggressive and overwriting valid activity names 
                    // when they weren't present in the update batch. Relying on UI validation.

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
                    // Check local DB if available, otherwise check if it matches range (>=56)
                    // We saw IDs start at 56. Simple heuristic.
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

        // 3.3 Proactive Fix: Filter out non-existent fields for CRM_Oportunidades
        // This handles items already in the outbox that contain the invalid 'ciudad' field.
        if (batches['CRM_Oportunidades']) {
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
        }
        const sortedTables = Object.entries(batches).sort(([tableA], [tableB]) => {
            const priorityA = TABLE_PRIORITY[tableA] || 99;
            const priorityB = TABLE_PRIORITY[tableB] || 99;
            return priorityA - priorityB;
        });

        for (const [table, updates] of sortedTables) {
            try {
                console.log(`[Sync] DEBUG - Sending RPC for ${table} with updates:`, JSON.stringify(updates, null, 2));

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
                console.log(`[Sync] DEBUG - Full RPC results:`, JSON.stringify(results, null, 2));

                for (const result of results) {
                    if (result.success) {
                        if (result.field === '_all') {
                            // Successful INSERT (or consolidated update): remove ALL pending items for this ID
                            const idsToDelete = pending
                                .filter(p => p.entity_id === result.id && p.entity_type === table)
                                .map(p => p.id);
                            await db.outbox.bulkDelete(idsToDelete);
                        } else {
                            // Successful single field update
                            const item = pending.find(p => p.entity_id === result.id && p.field_name === result.field && p.entity_type === table);
                            if (item) await db.outbox.delete(item.id);
                        }
                    } else {
                        // Failure: Mark relevant items as FAILED
                        const itemsToFail = result.field === '_all'
                            ? pending.filter(p => p.entity_id === result.id && p.entity_type === table)
                            : pending.filter(p => p.entity_id === result.id && p.field_name === result.field && p.entity_type === table);

                        for (const item of itemsToFail) {
                            console.warn(`[Sync] Push failed for ${table}.${item.field_name}: ${result.message}`);
                            await db.outbox.update(item.id, {
                                status: 'FAILED',
                                error: result.message,
                                retry_count: (item.retry_count || 0) + 1
                            });
                        }
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
            // PERF OPTIMIZATION: Disable full sync.
            /*
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
            */

            // Pull Phases (CRM_FasesOportunidad)
            try {
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
                    await db.subclasificaciones.clear();
                    await db.subclasificaciones.bulkPut(subs.map((s: any) => ({
                        id: s.id,
                        nombre: s.nombre,
                        canal_id: s.canal_id
                    })));
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
                    await db.activityClassifications.clear();
                    await db.activityClassifications.bulkPut(actCls.map((c: any) => ({
                        id: c.id,
                        nombre: c.nombre,
                        tipo_actividad: c.tipo_actividad
                    })));
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
                    await db.activitySubclassifications.clear();
                    await db.activitySubclassifications.bulkPut(actSubs.map((s: any) => ({
                        id: s.id,
                        nombre: s.nombre,
                        clasificacion_id: s.clasificacion_id
                    })));
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
                    await db.segments.clear();
                    await db.segments.bulkPut(segments.map((s: any) => ({
                        id: s.id,
                        nombre: s.nombre,
                        subclasificacion_id: s.subclasificacion_id
                    })));
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
                    await db.departments.clear();
                    await db.departments.bulkPut(deps.map((d: any) => ({
                        id: d.id,
                        nombre: d.nombre
                    })));
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
                    await db.cities.clear();
                    await db.cities.bulkPut(cities.map((c: any) => ({
                        id: c.id,
                        departamento_id: c.departamento_id,
                        nombre: c.nombre
                    })));
                    console.log(`[Sync] Pulled ${cities.length} cities.`);
                }
            } catch (cityErr: any) {
                console.error('[Sync] Failed to pull cities:', cityErr.message);
            }

            // Pull Contacts (CRM_Contactos) - SMART MERGE
            // PERF OPTIMIZATION: Disable full sync. Only sync by demand or recents in future.
            /*
            const { data: contacts, error: contactsError } = await supabase
                .from('CRM_Contactos')
                .select('*')
                .eq('is_deleted', false);
    
            if (contactsError) throw contactsError;
    
            if (contacts && contacts.length > 0) {
                // Smart merge: Skip records with pending changes
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
            */

            // Pull Opportunities (CRM_Oportunidades) - SMART MERGE
            // PERF OPTIMIZATION: Disable full sync.
            /*
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
            */

            // Pull Quotes (CRM_Cotizaciones) - SMART MERGE
            // PERF OPTIMIZATION: Disable full sync.
            /*
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
            */

            // Pull Activities (CRM_Actividades) - SMART MERGE
            // Re-enabled to ensure activities persist across browser sessions
            try {
                const { data: activities, error: activitiesError } = await supabase
                    .from('CRM_Actividades')
                    .select('*')
                    .eq('is_deleted', false);

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

                    let mergedCount = 0;
                    let skippedCount = 0;

                    for (const a of activities) {
                        if (pendingActivityIds.has(a.id)) {
                            skippedCount++;
                            continue;
                        }
                        await db.activities.put(a);
                        mergedCount++;
                    }
                    console.log(`[Sync] Merged ${mergedCount} activities (${skippedCount} with pending changes skipped).`);
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
        useSyncStore.getState().setProcessing(true);
        try {
            console.log('[SyncEngine] DEBUG - queueMutation called:', { entityTable, entityId });
            console.log('[SyncEngine] DEBUG - changes object:', changes);
            console.log('[SyncEngine] DEBUG - subclasificacion_id in changes:', changes.subclasificacion_id);

            const now = Date.now();
            const items: OutboxItem[] = [];

            for (const [field, value] of Object.entries(changes)) {
                if (value === undefined) continue; // Skip undefined fields
                if (field === '_sync_metadata') continue; // Skip sync metadata
                if (field === 'id') continue; // Skip ID (it's the key, not a field to update)

                console.log(`[SyncEngine] DEBUG - Adding field to outbox: ${field} = ${JSON.stringify(value)}`);

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

            console.log('[SyncEngine] DEBUG - Total items to queue:', items.length);
            console.log('[SyncEngine] DEBUG - Items:', items.map(i => ({ field: i.field_name, value: i.new_value })));

            await db.outbox.bulkAdd(items);
            this.updatePendingCount();

            // Update local mirror immediately (Optimistic UI)
            // await db.table(entityTable).update(entityId, changes); 
            // Note: Needs mapping logic if local table names differ slightly or just generic

            // Trigger Sync and WAIT for it to complete (critical for server-side list consistency)
            await this.triggerSync();
        } finally {
            useSyncStore.getState().setProcessing(false);
        }
    }
    async getCurrentUser() {
        return await supabase.auth.getUser();
    }
}

export const syncEngine = new SyncEngine();
