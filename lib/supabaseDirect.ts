export type DirectEntityTable =
    | 'CRM_Actividades'
    | 'CRM_Cotizaciones'
    | 'CRM_CotizacionItems'
    | 'CRM_Oportunidades'
    | 'CRM_Oportunidades_Colaboradores'
    | 'CRM_Contactos'
    | 'CRM_Cuentas'
    | 'CRM_Pedidos'
    | 'CRM_PedidoItems'
    | 'CRM_SapIntegrationQueue';

export interface DirectMutationRequest {
    entityTable: DirectEntityTable;
    entityId: string;
    changes: Record<string, unknown>;
    mode?: 'upsert' | 'update';
}

const DATE_OR_TIMESTAMP_COLUMNS = new Set([
    'fecha_inicio',
    'fecha_fin',
    'fecha_entrega',
    'fecha_cierre_estimada',
    'fecha_minima_requerida',
    'fecha_facturacion',
    'expectedCloseDate',
    'closeDate',
]);

/**
 * Exact writable columns in Supabase (excluding generated columns like CRM_CotizacionItems.subtotal,
 * serial PKs like CRM_Pedidos.id, and UI-only fields like is_winner or is_child).
 */
export const TABLE_COLUMNS: Record<DirectEntityTable, ReadonlySet<string>> = {
    CRM_Actividades: new Set([
        'id', 'opportunity_id', 'user_id', 'tipo_actividad_id', 'asunto', 'descripcion',
        'fecha_inicio', 'fecha_fin', 'ms_planner_id', 'ms_event_id', 'created_at', 'updated_at',
        'is_completed', '_sync_metadata', 'created_by', 'updated_by', 'is_deleted',
        'tipo_actividad', 'clasificacion_id', 'subclasificacion_id', 'Tarea_planner',
        'teams_meeting_url', 'microsoft_attendees', 'account_id', 'prioridad',
    ]),
    CRM_Cotizaciones: new Set([
        'id', 'opportunity_id', 'numero_cotizacion', 'total_amount', 'currency_id', 'status',
        'sap_doc_entry', 'created_at', 'updated_at', 'created_by', 'updated_by', '_sync_metadata',
        'is_deleted', 'segmento_id', 'cierre_facturacion', 'es_muestra', 'verificacion_previa_firplak',
        'direccion_envio_factura', 'sap_doc_num', 'tipo_pod', 'pod', 'comentarios', 'cliente_final',
        'email_contacto', 'contacto_ventas', 'contacto_logistico', 'contacto_tesoreria',
        'dir_envio_factura_tipo', 'servicio_subida_hidromasaje', 'piso_entrega', 'tiene_escaleras',
        'planos_hidromasaje', 'fecha_entrega', 'nit_cliente_final', 'entrega_en_obra',
        'bodega_externa', 'bodega_firplak',
    ]),
    CRM_CotizacionItems: new Set([
        // Note: subtotal is GENERATED ALWAYS in PostgreSQL and must never be sent in INSERT/UPDATE.
        'id', 'cotizacion_id', 'producto_id', 'cantidad', 'precio_unitario', 'descripcion_linea',
        '_sync_metadata', 'updated_at', 'created_by', 'updated_by', 'is_deleted',
        'discount_pct', 'max_discount_pct', 'final_unit_price',
    ]),
    CRM_Oportunidades: new Set([
        'id', 'account_id', 'owner_user_id', 'nombre', 'amount', 'currency_id', 'estado_id',
        'fase_id', 'fecha_cierre_estimada', 'probabilidad', 'sap_doc_entry', 'sap_order_id',
        'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted', '_sync_metadata',
        'items', 'segmento_id', 'departamento_id', 'ciudad_id', 'probability', 'razon_perdida_id',
        'origen_oportunidad', 'url_origen', 'fuente_conversion', 'pais_id', 'razon_perdida',
        'comentarios_perdida', 'comentarios', 'direccion_entrega', 'categoria_oportunidad',
        'contactos_ids', 'clientes_atendidos', 'fecha_entrega', 'setter', 'categoria',
        'subcategoria', 'Handsoff',
    ]),
    CRM_Oportunidades_Colaboradores: new Set([
        'id', 'oportunidad_id', 'usuario_id', 'porcentaje', 'rol', 'created_at', 'created_by',
        'is_deleted', 'updated_at', 'updated_by', '_sync_metadata',
    ]),
    CRM_Contactos: new Set([
        'id', 'account_id', 'nombre', 'cargo', 'email', 'telefono', 'es_principal',
        'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted',
        '_sync_metadata', 'comentarios',
    ]),
    CRM_Cuentas: new Set([
        'id', 'id_cuenta_principal', 'nit_base', 'nit_sufijo', 'nombre', 'telefono', 'direccion',
        'ciudad', 'email', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_deleted',
        '_sync_metadata', 'canal_id', 'es_premium', 'tipo_id', 'subclasificacion_id',
        'nivel_premium', 'departamento_id', 'ciudad_id', 'owner_user_id', 'nit', 'pais_id',
        'comentarios', 'ignorar_limites_descuento', 'origen_cuenta',
    ]),
    CRM_Pedidos: new Set([
        // Note: 'id' is serial/bigint in Postgres; 'uuid_generado' is the UUID conflict key.
        'salesOrderNumber', 'reference', 'stateSalesOrder', 'amountSalesOrder', 'expectedCloseDate',
        'closeDate', 'responsible', 'fCreado', 'extID', 'company', 'opportunity', 'EXTRA_Entorno',
        'EXTRA_NIT/C.C.', 'EXTRA_Dirección de entrega', 'EXTRA_Ciudad de entrega',
        'EXTRA_Teléfono de entrega', 'EXTRA_Dirección Factura', 'EXTRA_Ciudad Factura',
        'EXTRA_Teléfono Factura', 'EXTRA_Fecha mínima requerida por comercial/cliente',
        'EXTRA_Fecha de facturación', 'EXTRA_Tipo de facturación', 'EXTRA_Notas', 'EXTRA_IVA',
        'EXTRA_Gran Total', 'EXTRA_Formas de pago', 'EXTRA_Segmento', 'EXTRA_Contacto 1',
        'EXTRA_Contacto 2', 'EXTRA_Contacto 3', 'EXTRA_Facturación Electrónica', 'EXTRA_OC/COT',
        'EXTRA_Cierre Facturación', 'EXTRA_Indique fecha', 'EXTRA_¿Es una muestra?',
        'EXTRA_¿Aplica contrato?', 'EXTRA_¿Multa por incumplimiento?',
        'EXTRA_Orden de compra/Purchase Order', 'EXTRA_Puerto embarque/Shipment Port',
        'EXTRA_Terminos de pago/Pay Terms', 'EXTRA_Puerto destino/Destination Port',
        'EXTRA_Via/Type of transport', 'EXTRA_Flete/Freight', 'EXTRA_Incoterm/Incoterm',
        'EXTRA_Seguro/Insurance', '_sync_metadata', 'updated_at', 'created_by', 'updated_by',
        'is_deleted', 'uuid_generado', 'cotizacion_id', 'opportunity_id', 'estado_pedido',
        'cliente_final', 'nit_cliente_final', 'contacto_ventas', 'contacto_logistico',
        'contacto_tesoreria', 'dir_envio_factura_tipo', 'piso_entrega',
        'servicio_subida_hidromasaje', 'entrega_en_obra', 'bodega_externa', 'bodega_firplak',
        'cierre_facturacion', 'es_muestra', 'verificacion_previa_firplak',
        'direccion_envio_factura', 'sap_doc_entry', 'numero_pedido', 'tipo_pod', 'pod',
        'email_contacto', 'tiene_escaleras', 'planos_hidromasaje', 'fecha_entrega',
    ]),
    CRM_PedidoItems: new Set([
        'id', 'pedido_uuid', 'producto_id', 'cantidad', 'precio_unitario', 'descuento',
        'created_at', '_sync_metadata', 'updated_at', 'is_deleted',
    ]),
    CRM_SapIntegrationQueue: new Set([
        'id', 'entity_type', 'entity_id', 'payload', 'status', 'created_at', 'updated_at',
    ]),
};

export function conflictColumnForTable(tableName: DirectEntityTable): 'id' | 'uuid_generado' {
    return tableName === 'CRM_Pedidos' ? 'uuid_generado' : 'id';
}

export function sanitizeTablePayload(
    tableName: DirectEntityTable,
    record: Record<string, unknown>
): Record<string, unknown> {
    const allowed = TABLE_COLUMNS[tableName];
    const sanitized: Record<string, unknown> = {};

    for (const [key, rawValue] of Object.entries(record)) {
        if (!allowed.has(key) || rawValue === undefined) continue;
        if (DATE_OR_TIMESTAMP_COLUMNS.has(key) && rawValue === '') {
            sanitized[key] = null;
        } else {
            sanitized[key] = rawValue;
        }
    }

    return sanitized;
}

function dispatchOptimisticEvents(requests: DirectMutationRequest[]): void {
    if (typeof window === 'undefined') return;
    for (const request of requests) {
        window.dispatchEvent(
            new CustomEvent('crm-optimistic-update', {
                detail: {
                    entityType: request.entityTable,
                    entityId: request.entityId,
                    updates: request.changes,
                },
            })
        );
    }
}

function canExecuteRemoteSupabase(): boolean {
    if (typeof window !== 'undefined') {
        if (process.env.NODE_ENV !== 'production' && window.location?.pathname?.startsWith('/e2e/')) {
            return false;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return false;
        }
    }
    return true;
}

/**
 * Executes local state updates and immediately persists every mutation directly to Supabase
 * without queuing into db.outbox.
 */
export async function executeDirectMutations(
    writeLocal: () => Promise<DirectMutationRequest[]>
): Promise<void> {
    const requests = await writeLocal();
    dispatchOptimisticEvents(requests);

    if (!canExecuteRemoteSupabase() || requests.length === 0) {
        return;
    }

    let supabaseClient;
    try {
        const mod = await import('./supabase');
        supabaseClient = mod.supabase;
    } catch {
        return;
    }

    for (const req of requests) {
        const conflictCol = conflictColumnForTable(req.entityTable);
        const payload = sanitizeTablePayload(req.entityTable, {
            ...req.changes,
            [conflictCol]: req.changes[conflictCol] ?? req.entityId,
        });

        try {
            if (req.mode === 'update') {
                const { error } = await supabaseClient
                    .from(req.entityTable)
                    .update(payload)
                    .eq(conflictCol, req.entityId);
                if (error) {
                    console.warn(`[supabaseDirect] Update warning on ${req.entityTable} (${req.entityId}):`, error.message);
                }
            } else {
                const { error } = await supabaseClient
                    .from(req.entityTable)
                    .upsert(payload, { onConflict: conflictCol });
                if (error) {
                    // Fallback to partial update if upsert lacks NOT NULL columns on an existing record
                    const { error: updateErr } = await supabaseClient
                        .from(req.entityTable)
                        .update(payload)
                        .eq(conflictCol, req.entityId);
                    if (updateErr) {
                        console.warn(`[supabaseDirect] Upsert/Update warning on ${req.entityTable} (${req.entityId}):`, error.message);
                    }
                }
            }
        } catch (err) {
            console.warn(`[supabaseDirect] Network error persisting ${req.entityTable} (${req.entityId}):`, err);
        }
    }
}

/**
 * Fetches a single record directly from Supabase if it is not yet in the local reactive store.
 */
export async function fetchRecordDirect<T extends Record<string, unknown>>(
    tableName: DirectEntityTable,
    entityId: string
): Promise<T | null> {
    if (!canExecuteRemoteSupabase() || !entityId) return null;
    const conflictCol = conflictColumnForTable(tableName);
    try {
        const { supabase: supabaseClient } = await import('./supabase');
        const { data, error } = await supabaseClient
            .from(tableName)
            .select('*')
            .eq(conflictCol, entityId)
            .maybeSingle();
        if (error || !data) return null;
        return data as T;
    } catch {
        return null;
    }
}

/**
 * Loads activity classification and subclassification catalogs directly from Supabase.
 */
export async function hydrateActivityCatalogsFromSupabase(): Promise<void> {
    if (!canExecuteRemoteSupabase()) return;
    try {
        const [{ supabase: supabaseClient }, { db }] = await Promise.all([
            import('./supabase'),
            import('./db'),
        ]);
        const [classRes, subRes] = await Promise.all([
            supabaseClient.from('CRM_Activity_Clasificacion').select('*').eq('is_deleted', false),
            supabaseClient.from('CRM_Activity_Subclasificacion').select('*').eq('is_deleted', false),
        ]);
        if (!classRes.error && Array.isArray(classRes.data) && classRes.data.length > 0) {
            await db.activityClassifications.bulkPut(classRes.data);
        }
        if (!subRes.error && Array.isArray(subRes.data) && subRes.data.length > 0) {
            await db.activitySubclassifications.bulkPut(subRes.data);
        }
    } catch (err) {
        console.warn('[supabaseDirect] Activity catalogs hydration warning:', err);
    }
}

/**
 * Loads lightweight reference catalogs (phases, subclassifications, segments, countries,
 * departments, cities, loss reasons, activity classifications) directly from Supabase
 * without running the background SyncEngine entity pull loop.
 */
export async function hydrateReferenceCatalogsFromSupabase(): Promise<void> {
    if (!canExecuteRemoteSupabase()) return;
    try {
        const [{ supabase: supabaseClient }, { db }] = await Promise.all([
            import('./supabase'),
            import('./db'),
        ]);

        const [
            phasesRes,
            subclassRes,
            segmentsRes,
            countriesRes,
            deptsRes,
            citiesRes,
            lossReasonsRes,
        ] = await Promise.all([
            supabaseClient.from('CRM_FasesOportunidad').select('*'),
            supabaseClient.from('CRM_Subclasificacion').select('*'),
            supabaseClient.from('CRM_Segmentos').select('*'),
            supabaseClient.from('CRM_Paises').select('*'),
            supabaseClient.from('CRM_Departamentos').select('*'),
            supabaseClient.from('CRM_Ciudades').select('*'),
            supabaseClient.from('CRM_RazonesPerdida').select('*'),
        ]);

        if (!phasesRes.error && Array.isArray(phasesRes.data) && phasesRes.data.length > 0) {
            await db.phases.bulkPut(phasesRes.data);
        }
        if (!subclassRes.error && Array.isArray(subclassRes.data) && subclassRes.data.length > 0) {
            await db.subclasificaciones.bulkPut(subclassRes.data);
        }
        if (!segmentsRes.error && Array.isArray(segmentsRes.data) && segmentsRes.data.length > 0) {
            await db.segments.bulkPut(segmentsRes.data);
        }
        if (!countriesRes.error && Array.isArray(countriesRes.data) && countriesRes.data.length > 0) {
            await db.countries.bulkPut(countriesRes.data);
        }
        if (!deptsRes.error && Array.isArray(deptsRes.data) && deptsRes.data.length > 0) {
            await db.departments.bulkPut(deptsRes.data);
        }
        if (!citiesRes.error && Array.isArray(citiesRes.data) && citiesRes.data.length > 0) {
            await db.cities.bulkPut(citiesRes.data);
        }
        if (!lossReasonsRes.error && Array.isArray(lossReasonsRes.data) && lossReasonsRes.data.length > 0) {
            await db.lossReasons.bulkPut(lossReasonsRes.data);
        }

        await hydrateActivityCatalogsFromSupabase();
    } catch (err) {
        console.warn('[supabaseDirect] Reference catalogs hydration warning:', err);
    }
}

/**
 * Directly loads an opportunity, its linked account, contacts, collaborators, quotes, and quote items
 * from Supabase when viewing /oportunidades/[id].
 */
export async function hydrateOpportunityDetailFromSupabase(
    opportunityId: string
): Promise<{ oppData: Record<string, unknown> | null; collaborators: Record<string, unknown>[] }> {
    if (!canExecuteRemoteSupabase() || !opportunityId) {
        return { oppData: null, collaborators: [] };
    }
    try {
        const [{ supabase: supabaseClient }, { db }] = await Promise.all([
            import('./supabase'),
            import('./db'),
        ]);

        const [oppRes, collabsRes, quotesRes] = await Promise.all([
            supabaseClient.from('CRM_Oportunidades').select('*').eq('id', opportunityId).maybeSingle(),
            supabaseClient.from('CRM_Oportunidades_Colaboradores').select('*').eq('oportunidad_id', opportunityId),
            supabaseClient.from('CRM_Cotizaciones').select('*').eq('opportunity_id', opportunityId).eq('is_deleted', false),
        ]);

        const oppData = (oppRes.data as Record<string, unknown> | null) ?? null;
        if (oppData) {
            await db.opportunities.put(oppData as never);
            const accountId = typeof oppData.account_id === 'string' ? oppData.account_id : '';
            if (accountId) {
                const [accRes, contactsRes] = await Promise.all([
                    supabaseClient.from('CRM_Cuentas').select('*').eq('id', accountId).maybeSingle(),
                    supabaseClient.from('CRM_Contactos').select('*').eq('account_id', accountId).eq('is_deleted', false),
                ]);
                if (accRes.data) await db.accounts.put(accRes.data as never);
                if (Array.isArray(contactsRes.data) && contactsRes.data.length > 0) {
                    await db.contacts.bulkPut(contactsRes.data as never);
                }
            }
        }

        const collaborators = (Array.isArray(collabsRes.data) ? collabsRes.data : []) as Record<string, unknown>[];
        if (collaborators.length > 0) {
            await db.opportunityCollaborators.bulkPut(collaborators as never);
        }

        if (Array.isArray(quotesRes.data) && quotesRes.data.length > 0) {
            await db.quotes.bulkPut(quotesRes.data as never);
            const quoteIds = quotesRes.data.map((q: { id?: string }) => q.id).filter(Boolean) as string[];
            if (quoteIds.length > 0) {
                const { data: itemsData } = await supabaseClient
                    .from('CRM_CotizacionItems')
                    .select('*')
                    .in('cotizacion_id', quoteIds)
                    .eq('is_deleted', false);
                if (Array.isArray(itemsData) && itemsData.length > 0) {
                    await db.quoteItems.bulkPut(itemsData as never);
                }
            }
        }

        return { oppData, collaborators };
    } catch (err) {
        console.warn('[supabaseDirect] Opportunity detail hydration warning:', err);
        return { oppData: null, collaborators: [] };
    }
}

/**
 * Directly loads a quote, its items, its parent opportunity, account, contacts, and pedidos
 * from Supabase when viewing /oportunidades/[id]/cotizaciones/[quoteId].
 */
export async function hydrateQuoteDetailFromSupabase(
    opportunityId: string,
    quoteId: string
): Promise<void> {
    if (!canExecuteRemoteSupabase() || !quoteId) return;
    try {
        const [{ supabase: supabaseClient }, { db }] = await Promise.all([
            import('./supabase'),
            import('./db'),
        ]);

        const [quoteRes, itemsRes, pedidosRes] = await Promise.all([
            supabaseClient.from('CRM_Cotizaciones').select('*').eq('id', quoteId).maybeSingle(),
            supabaseClient.from('CRM_CotizacionItems').select('*').eq('cotizacion_id', quoteId).eq('is_deleted', false),
            supabaseClient.from('CRM_Pedidos').select('*').eq('cotizacion_id', quoteId).eq('is_deleted', false),
        ]);

        if (quoteRes.data) {
            await db.quotes.put(quoteRes.data as never);
        }
        if (Array.isArray(itemsRes.data) && itemsRes.data.length > 0) {
            await db.quoteItems.bulkPut(itemsRes.data as never);
        }
        if (Array.isArray(pedidosRes.data) && pedidosRes.data.length > 0) {
            await db.pedidos.bulkPut(pedidosRes.data as never);
            const pedidoUuids = pedidosRes.data
                .map((p: { uuid_generado?: string }) => p.uuid_generado)
                .filter(Boolean) as string[];
            if (pedidoUuids.length > 0) {
                const { data: pItems } = await supabaseClient
                    .from('CRM_PedidoItems')
                    .select('*')
                    .in('pedido_uuid', pedidoUuids)
                    .eq('is_deleted', false);
                if (Array.isArray(pItems) && pItems.length > 0) {
                    await db.pedidoItems.bulkPut(pItems as never);
                }
            }
        }

        const targetOppId = opportunityId || (quoteRes.data as { opportunity_id?: string } | null)?.opportunity_id || '';
        if (targetOppId) {
            await hydrateOpportunityDetailFromSupabase(targetOppId);
        }
    } catch (err) {
        console.warn('[supabaseDirect] Quote detail hydration warning:', err);
    }
}

/**
 * Directly loads active pedidos, pedido items, and their linked quotes and opportunities
 * from Supabase when viewing /pedidos.
 */
export async function hydratePedidosModuleFromSupabase(): Promise<void> {
    if (!canExecuteRemoteSupabase()) return;
    try {
        const [{ supabase: supabaseClient }, { db }] = await Promise.all([
            import('./supabase'),
            import('./db'),
        ]);

        const { data: pedidosData, error: pedErr } = await supabaseClient
            .from('CRM_Pedidos')
            .select('*')
            .eq('is_deleted', false)
            .order('updated_at', { ascending: false })
            .limit(1000);

        if (pedErr || !Array.isArray(pedidosData) || pedidosData.length === 0) return;
        await db.pedidos.bulkPut(pedidosData as never);

        const pedidoUuids = Array.from(
            new Set(pedidosData.map((p: { uuid_generado?: string }) => p.uuid_generado).filter(Boolean) as string[])
        );
        const quoteIds = Array.from(
            new Set(pedidosData.map((p: { cotizacion_id?: string }) => p.cotizacion_id).filter(Boolean) as string[])
        );
        const oppIds = new Set(
            pedidosData.map((p: { opportunity_id?: string }) => p.opportunity_id).filter(Boolean) as string[]
        );

        if (pedidoUuids.length > 0) {
            const { data: pItems } = await supabaseClient
                .from('CRM_PedidoItems')
                .select('*')
                .in('pedido_uuid', pedidoUuids.slice(0, 500))
                .eq('is_deleted', false);
            if (Array.isArray(pItems) && pItems.length > 0) {
                await db.pedidoItems.bulkPut(pItems as never);
            }
        }

        if (quoteIds.length > 0) {
            const { data: quotesData } = await supabaseClient
                .from('CRM_Cotizaciones')
                .select('*')
                .in('id', quoteIds.slice(0, 500));
            if (Array.isArray(quotesData) && quotesData.length > 0) {
                await db.quotes.bulkPut(quotesData as never);
                for (const q of quotesData as Array<{ opportunity_id?: string }>) {
                    if (q.opportunity_id) oppIds.add(q.opportunity_id);
                }
            }
        }

        const oppIdList = Array.from(oppIds);
        if (oppIdList.length > 0) {
            const { data: oppsData } = await supabaseClient
                .from('CRM_Oportunidades')
                .select('*')
                .in('id', oppIdList.slice(0, 500));
            if (Array.isArray(oppsData) && oppsData.length > 0) {
                await db.opportunities.bulkPut(oppsData as never);
            }
        }
    } catch (err) {
        console.warn('[supabaseDirect] Pedidos module hydration warning:', err);
    }
}


