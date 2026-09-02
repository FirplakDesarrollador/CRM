import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalOportunidad, LocalOpportunityCollaborator, LocalQuote, LocalQuoteItem } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { sendOpportunityDeletionEmail } from "@/lib/services/notifications";

// Helper to fetch pricing from server
async function fetchPricing(productId: string, channelId: string, qty: number) {
    try {
        if (!navigator.onLine) return null;

        // 1. Get numero_articulo from ID
        // Note: Ideally we should have this locally or passed in. 
        // For now we fetch it to be safe.
        const { data: prodData } = await supabase
            .from('CRM_ListaDePrecios')
            .select('numero_articulo')
            .eq('id', productId)
            .single();

        if (!prodData) return null;

        // 2. Call RPC
        // Returns { base_price, discount_pct, final_unit_price }
        // "discount_pct" here acts as the VOLUME LIMIT (Max allowed discount)
        const { data, error } = await supabase.rpc('get_recommended_pricing', {
            p_numero_articulo: prodData.numero_articulo,
            p_canal_id: channelId,
            p_qty: qty
        });

        if (error) {
            console.error("Error fetching pricing:", error);
            return null;
        }

        return data; // { base_price, discount_pct, final_unit_price }
    } catch (err) {
        console.error(err);
        return null; // Fallback to provided price
    }
}

// Helper to sanitize opportunity data before syncing
function sanitizeOpportunityForSync(opp: any) {
    const {
        ciudad, // Text representation of city from UI
        fase,   // Joined phase name
        valor,  // Legacy 'valor' field (replaced by 'amount')
        items,  // Items are synced separately through CRM_CotizacionItems
        status, // Legacy 'status' field (replaced by 'estado_id')
        _sync_metadata, // Exclude system field to prevent sync loops
        ...sanitized
    } = opp;

    // Ensure numeric fields are indeed numbers
    if (sanitized.amount !== undefined) sanitized.amount = sanitized.amount ? Number(sanitized.amount) : 0;
    if (sanitized.segmento_id !== undefined) sanitized.segmento_id = sanitized.segmento_id ? Number(sanitized.segmento_id) : null;
    if (sanitized.departamento_id !== undefined) sanitized.departamento_id = sanitized.departamento_id ? Number(sanitized.departamento_id) : null;
    if (sanitized.ciudad_id !== undefined) sanitized.ciudad_id = sanitized.ciudad_id ? Number(sanitized.ciudad_id) : null;
    if (sanitized.estado_id !== undefined) sanitized.estado_id = sanitized.estado_id ? Number(sanitized.estado_id) : 1;
    if (sanitized.fase_id !== undefined) sanitized.fase_id = sanitized.fase_id ? Number(sanitized.fase_id) : 1;
    if (sanitized.razon_perdida_id !== undefined) sanitized.razon_perdida_id = sanitized.razon_perdida_id ? Number(sanitized.razon_perdida_id) : null;
    if (sanitized.clientes_atendidos !== undefined) sanitized.clientes_atendidos = sanitized.clientes_atendidos !== null && sanitized.clientes_atendidos !== "" ? Number(sanitized.clientes_atendidos) : 0;
    if (sanitized.contactos_ids !== undefined) sanitized.contactos_ids = Array.isArray(sanitized.contactos_ids) ? sanitized.contactos_ids : [];
    // Text fields — pass through as-is (no conversion needed)
    // razon_perdida and comentarios_perdida are already strings or null

    return sanitized;
}

export function useOpportunities(filters?: { advisor_id?: string | null }) {
    const { user, isVendedor, isAdmin, isCoordinador } = useCurrentUser();
    const userId = user?.id;

    const opportunities = useLiveQuery(
        async () => {
            // Priority 1: Specific advisor filter from Dashboard
            if (filters?.advisor_id) {
                return db.opportunities.where('owner_user_id').equals(filters.advisor_id).toArray();
            }

            // Priority 2: Vendedor role restriction
            if (isVendedor && userId) {
                // Get IDs of opportunities where user is a collaborator
                const collaborators = await db.opportunityCollaborators
                    .where('usuario_id')
                    .equals(userId)
                    .toArray();
                const collaboratedIds = new Set(collaborators.map(c => c.oportunidad_id));

                return db.opportunities.filter(o => 
                    o.owner_user_id === userId || 
                    (!o.owner_user_id && o.created_by === userId) ||
                    collaboratedIds.has(o.id)
                ).toArray();
            }

            return db.opportunities.toArray();
        },
        [isVendedor, userId, filters?.advisor_id]
    );

    const createOpportunity = async (data: any) => {
        const id = uuidv4();
        const { items, collaborators, ...oppData } = data;

        // Fetch current user for ownership
        const { data: { user } } = await syncEngine.getCurrentUser();

        const newOpp = {
            ...oppData,
            // items removed to avoid syncing them to CRM_Oportunidades
            id,
            owner_user_id: oppData.owner_user_id || user?.id,
            account_id: oppData.account_id,
            estado_id: oppData.estado_id || 1,
            fase_id: oppData.fase_id || 1,
            segmento_id: oppData.segmento_id ? Number(oppData.segmento_id) : null,
            departamento_id: oppData.departamento_id ? Number(oppData.departamento_id) : null,
            ciudad_id: oppData.ciudad_id ? Number(oppData.ciudad_id) : null,
            fecha_cierre_estimada: oppData.fecha_cierre_estimada === "" ? null : (oppData.fecha_cierre_estimada || null),
            contactos_ids: Array.isArray(oppData.contactos_ids) ? oppData.contactos_ids : [],
            clientes_atendidos: oppData.clientes_atendidos !== undefined && oppData.clientes_atendidos !== null && oppData.clientes_atendidos !== "" ? Number(oppData.clientes_atendidos) : 0,
            created_by: user?.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };
        const collabEntries: LocalOpportunityCollaborator[] = collaborators?.map((c: any) => ({
            id: uuidv4(),
            oportunidad_id: id,
            usuario_id: c.usuario_id,
            porcentaje: c.porcentaje,
            rol: c.rol || 'COLABORADOR',
            created_at: new Date().toISOString()
        })) || [];

        let newQuote: LocalQuote | null = null;
        let quoteItems: LocalQuoteItem[] = [];

        // If items are present, create an initial quote
        if (items && items.length > 0) {
            const quoteId = uuidv4();
            newQuote = {
                id: quoteId,
                opportunity_id: id,
                numero_cotizacion: `COT-${Date.now().toString().slice(-6)}`,
                status: 'DRAFT',
                total_amount: oppData.amount || 0,
                currency_id: oppData.currency_id || 'COP',
                created_by: user?.id,
                updated_by: user?.id,
                updated_at: new Date().toISOString()
            };

            const account = await db.accounts.get(oppData.account_id);
            const channelId = account?.canal_id || 'DIST_NAC';

            quoteItems = await Promise.all(items.map(async (item: any) => {
                // We rely on the Wizard to have picked the correct base price (item.precio) based on channel
                // We ONLY call fetchPricing to retrieve the VOLUME LIMIT (max_discount_pct) if available.
                // We ignore the RPC's base_price to avoid overwriting the specific column logic.
                const pricing = await fetchPricing(item.product_id, channelId, item.cantidad);

                // Pricing Logic:
                // unitPrice = Trusted from Wizard (item.precio)
                // maxDiscount = From RPC (volume limit)
                const unitPrice = item.precio || (pricing ? pricing.base_price : 0);
                const maxDiscount = pricing ? pricing.discount_pct : 0;

                const discount = Number(item.descuento_porcentaje) || 0;
                const finalPrice = parseFloat((unitPrice * (1 - discount / 100)).toFixed(10));

                return {
                    id: uuidv4(),
                    cotizacion_id: quoteId,
                    producto_id: item.product_id,
                    cantidad: item.cantidad,
                    precio_unitario: unitPrice,
                    discount_pct: discount,
                    max_discount_pct: maxDiscount,
                    final_unit_price: finalPrice,
                    subtotal: parseFloat((item.cantidad * finalPrice).toFixed(10)),
                    descripcion_linea: item.nombre
                };
            }));

        }

        await syncEngine.commitLocalChanges([
            db.opportunities, db.opportunityCollaborators, db.quotes, db.quoteItems
        ], async () => {
            await db.opportunities.add(newOpp);
            if (collabEntries.length > 0) await db.opportunityCollaborators.bulkAdd(collabEntries);
            if (newQuote) await db.quotes.add(newQuote);
            if (quoteItems.length > 0) await db.quoteItems.bulkAdd(quoteItems);

            return [
                { entityTable: 'CRM_Oportunidades', entityId: id, changes: sanitizeOpportunityForSync(newOpp), options: { isSnapshot: true } },
                ...collabEntries.map(col => ({ entityTable: 'CRM_Oportunidades_Colaboradores', entityId: col.id, changes: col })),
                ...(newQuote ? [{ entityTable: 'CRM_Cotizaciones', entityId: newQuote.id, changes: newQuote, options: { isSnapshot: true } }] : []),
                ...quoteItems.map(qi => {
                    const { subtotal, ...qiData } = qi;
                    return { entityTable: 'CRM_CotizacionItems', entityId: qi.id, changes: qiData, options: { isSnapshot: true } };
                })
            ];
        });

        return id;
    };

    const generateMockData = async () => {
        const { data: { user } } = await syncEngine.getCurrentUser();
        const userId = user?.id || uuidv4();

        const mocks = [
            {
                id: uuidv4(),
                account_id: uuidv4(), // Mock account
                nombre: "Reforma Oficinas Centrales",
                valor: 45000000,
                amount: 45000000,
                currency_id: "COP",
                fase_id: 1,
                owner_user_id: userId,
                status: "OPEN",
                updated_at: new Date().toISOString()
            },
            {
                id: uuidv4(),
                account_id: uuidv4(), // Mock account
                nombre: "Dotación Baños CC",
                valor: 12000,
                amount: 12000,
                currency_id: "USD",
                fase_id: 1,
                owner_user_id: userId,
                status: "OPEN",
                updated_at: new Date().toISOString()
            }
        ];
        await db.opportunities.bulkAdd(mocks);
    };

    const deleteOpportunity = async (id: string) => {
        const current = await db.opportunities.get(id);
        if (!current) return;

        // 1. Permission Check
        const isOwner = current.owner_user_id === userId || (!current.owner_user_id && current.created_by === userId);
        console.log('[deleteOpportunity] isAdmin:', isAdmin, 'isCoordinador:', isCoordinador, 'isOwner:', isOwner, 'userId:', userId);
        if (!isAdmin && !isCoordinador && !isOwner) {
            throw new Error("No tienes permiso para eliminar esta oportunidad");
        }

        // 2. Collect all related data BEFORE any transaction
        const quotes = await db.quotes.where('opportunity_id').equals(id).toArray();
        const quoteIds = quotes.map(q => q.id);
        const quoteItemsAll = quoteIds.length > 0
            ? await db.quoteItems.where('cotizacion_id').anyOf(quoteIds).toArray()
            : [];
        const collaborators = await db.opportunityCollaborators.where('oportunidad_id').equals(id).toArray();
        const activities = await db.activities.where('opportunity_id').equals(id).toArray();
        const pedidos = await db.pedidos.where('opportunity_id').equals(id).toArray();
        const pedidoUuids = pedidos.map(p => p.uuid_generado);
        const pedidoItemsAll = pedidoUuids.length > 0
            ? await db.pedidoItems.where('pedido_uuid').anyOf(pedidoUuids).toArray()
            : [];

        console.log('[deleteOpportunity] Found:', {
            quotes: quotes.length,
            quoteItems: quoteItemsAll.length,
            collaborators: collaborators.length,
            activities: activities.length,
            pedidos: pedidos.length,
            pedidoItems: pedidoItemsAll.length
        });

        await syncEngine.commitLocalChanges([
            db.opportunities,
            db.quotes,
            db.quoteItems,
            db.opportunityCollaborators,
            db.activities,
            db.pedidos,
            db.pedidoItems
        ], async () => {
            await db.opportunities.delete(id);
            if (quoteIds.length > 0) {
                await db.quotes.where('opportunity_id').equals(id).delete();
                await db.quoteItems.where('cotizacion_id').anyOf(quoteIds).delete();
            }
            await db.opportunityCollaborators.where('oportunidad_id').equals(id).delete();
            await db.activities.where('opportunity_id').equals(id).delete();
            if (pedidoUuids.length > 0) {
                await db.pedidos.where('opportunity_id').equals(id).delete();
                await db.pedidoItems.where('pedido_uuid').anyOf(pedidoUuids).delete();
            }

            return [
                { entityTable: 'CRM_Oportunidades', entityId: id, changes: sanitizeOpportunityForSync({ ...current, is_deleted: true }), options: { isSnapshot: true } },
                ...collaborators.map(col => ({ entityTable: 'CRM_Oportunidades_Colaboradores', entityId: col.id, changes: { ...col, is_deleted: true }, options: { isSnapshot: true } })),
                ...quotes.map(quote => ({ entityTable: 'CRM_Cotizaciones', entityId: quote.id, changes: { ...quote, is_deleted: true }, options: { isSnapshot: true } })),
                ...quoteItemsAll.map(item => {
                    const { subtotal, ...itemData } = item;
                    return { entityTable: 'CRM_CotizacionItems', entityId: item.id, changes: { ...itemData, is_deleted: true }, options: { isSnapshot: true } };
                }),
                ...activities.map(activity => ({ entityTable: 'CRM_Actividades', entityId: activity.id, changes: { ...activity, is_deleted: true }, options: { isSnapshot: true } })),
                ...pedidos.map(pedido => ({ entityTable: 'CRM_Pedidos', entityId: pedido.uuid_generado, changes: { ...pedido, is_deleted: true }, options: { isSnapshot: true } })),
                ...pedidoItemsAll.map(pItem => ({ entityTable: 'CRM_PedidoItems', entityId: pItem.id, changes: { ...pItem, is_deleted: true }, options: { isSnapshot: true } }))
            ];
        });

        // 5. Send deletion notification (Fire and forget)
        sendOpportunityDeletionEmail(current).catch(err => {
            console.error('[deleteOpportunity] Error sending notification:', err);
        });
    };

    const updateOpportunity = async (id: string, updates: any) => {
        const current = await db.opportunities.get(id);
        if (!current) return;

        // Defensive conversion for numeric fields
        const sanitizedUpdates = {
            ...updates,
            segmento_id: updates.segmento_id !== undefined ? (updates.segmento_id ? Number(updates.segmento_id) : null) : undefined,
            departamento_id: updates.departamento_id !== undefined ? (updates.departamento_id ? Number(updates.departamento_id) : null) : undefined,
            ciudad_id: updates.ciudad_id !== undefined ? (updates.ciudad_id ? Number(updates.ciudad_id) : null) : undefined,
            razon_perdida_id: updates.razon_perdida_id !== undefined ? (updates.razon_perdida_id ? Number(updates.razon_perdida_id) : null) : undefined,
            razon_perdida: updates.razon_perdida !== undefined ? (updates.razon_perdida || null) : undefined,
            comentarios_perdida: updates.comentarios_perdida !== undefined ? (updates.comentarios_perdida || null) : undefined,
            clientes_atendidos: updates.clientes_atendidos !== undefined ? (updates.clientes_atendidos !== null && updates.clientes_atendidos !== "" ? Number(updates.clientes_atendidos) : 0) : undefined,
            contactos_ids: updates.contactos_ids !== undefined ? (Array.isArray(updates.contactos_ids) ? updates.contactos_ids : []) : undefined,
        };

        // Remove undefined fields to avoid overwriting with undefined
        Object.keys(sanitizedUpdates).forEach(key => (sanitizedUpdates as any)[key] === undefined && delete (sanitizedUpdates as any)[key]);

        const updated = {
            ...current,
            ...sanitizedUpdates,
            updated_at: new Date().toISOString(),
            // Sanitize critical dates (Postgres dislikes empty strings for DATE type)
            fecha_cierre_estimada: (updates.fecha_cierre_estimada === "" ? null : (updates.fecha_cierre_estimada ?? current.fecha_cierre_estimada))
        };
        // Double check if the merged result is still "" (from current)
        if (updated.fecha_cierre_estimada === "") updated.fecha_cierre_estimada = null;

        const quoteUpdates: LocalQuote[] = [];
        if (updates.segmento_id !== undefined) {
            const quotes = await db.quotes.where('opportunity_id').equals(id).toArray();
            for (const q of quotes) {
                if (q.segmento_id !== updates.segmento_id) {
                    quoteUpdates.push({ ...q, segmento_id: updates.segmento_id, updated_at: new Date().toISOString() });
                }
            }
        }

        await syncEngine.commitLocalChanges([db.opportunities, db.quotes], async () => {
            await db.opportunities.put(updated);
            if (quoteUpdates.length > 0) await db.quotes.bulkPut(quoteUpdates);
            return [
                { entityTable: 'CRM_Oportunidades', entityId: id, changes: sanitizeOpportunityForSync(updated), options: { isSnapshot: true } },
                ...quoteUpdates.map(quote => ({ entityTable: 'CRM_Cotizaciones', entityId: quote.id, changes: quote, options: { isSnapshot: true } }))
            ];
        });
    };

    return { opportunities, createOpportunity, generateMockData, deleteOpportunity, updateOpportunity };
}

// Internal version to be used by other hooks without hook dependency issues
async function performOpportunityUpdate(id: string, updates: any) {
    const current = await db.opportunities.get(id);
    if (!current) return;

    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    await syncEngine.commitLocalChanges([db.opportunities], async () => {
        await db.opportunities.put(updated);
        return [{
            entityTable: 'CRM_Oportunidades', entityId: id,
            changes: sanitizeOpportunityForSync(updated), options: { isSnapshot: true }
        }];
    });
}


export function useQuotes(opportunityId?: string) {
    const { user, isVendedor } = useCurrentUser();
    const userId = user?.id;

    const quotes = useLiveQuery(
        async () => {
            if (opportunityId) {
                return db.quotes.where('opportunity_id').equals(opportunityId).toArray();
            }

            const allQuotes = await db.quotes.toArray();

            // Priority 2: Vendedor role restriction
            if (isVendedor && userId) {
                const myOpps = await db.opportunities.where('owner_user_id').equals(userId).toArray();
                const myOppIds = new Set(myOpps.map(o => o.id));
                return allQuotes.filter(q => myOppIds.has(q.opportunity_id) || q.created_by === userId);
            }

            return allQuotes;
        },
        [isVendedor, userId, opportunityId]
    );

    const createQuote = async (oppId: string, initialData: Partial<LocalQuote>) => {
        const id = uuidv4();

        // Find existing quotes to inherit products from
        const existingQuotes = await db.quotes.where('opportunity_id').equals(oppId).toArray();
        const latestQuote = existingQuotes.sort((a, b) =>
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        )[0];

        // Or inherit from opportunity itself
        const opportunity = await db.opportunities.get(oppId);

        // Check Account Channel for Strict Currency
        let forcedCurrency = latestQuote?.currency_id || opportunity?.currency_id || 'COP';
        if (opportunity?.account_id) {
            const acc = await db.accounts.get(opportunity.account_id);
            if (acc && (acc.canal_id === 'OBRAS_INT' || acc.canal_id === 'DIST_INT')) {
                forcedCurrency = 'USD';
            }
        }

        const inheritedItems = latestQuote
            ? await db.quoteItems.where('cotizacion_id').equals(latestQuote.id).toArray()
            : (opportunity?.items || []);

        const { data: { user } } = await syncEngine.getCurrentUser();

        const newQuote: LocalQuote = {
            id,
            opportunity_id: oppId,
            numero_cotizacion: `COT-${Date.now().toString().slice(-6)}`,
            status: 'DRAFT',
            total_amount: latestQuote?.total_amount || 0,
            currency_id: forcedCurrency,
            segmento_id: latestQuote?.segmento_id || opportunity?.segmento_id || null,
            created_by: user?.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
            ...initialData
        };

        // Recalculate total if inherited from opportunity items
        if (!latestQuote && inheritedItems.length > 0) {
            newQuote.total_amount = inheritedItems.reduce((acc: number, item: any) =>
                acc + (item.cantidad * (item.precio_unitario || item.precio || 0)), 0
            );
        }

        const newItems: LocalQuoteItem[] = inheritedItems.length > 0
            ? inheritedItems.map((item: any) => ({
                id: uuidv4(),
                cotizacion_id: id,
                producto_id: item.product_id || item.producto_id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario || item.precio || 0,
                discount_pct: item.discount_pct || 0,
                final_unit_price: item.final_unit_price || item.precio_unitario || 0,
                subtotal: (item.cantidad * (item.final_unit_price || item.precio_unitario || item.precio || 0)),
                descripcion_linea: item.descripcion_linea || item.nombre
            }))
            : [];

        await syncEngine.commitLocalChanges([db.quotes, db.quoteItems], async () => {
            await db.quotes.add(newQuote);
            if (newItems.length > 0) await db.quoteItems.bulkAdd(newItems);
            return [
                { entityTable: 'CRM_Cotizaciones', entityId: id, changes: newQuote, options: { isSnapshot: true } },
                ...newItems.map(item => {
                    const { subtotal, ...itemData } = item;
                    return { entityTable: 'CRM_CotizacionItems', entityId: item.id, changes: itemData, options: { isSnapshot: true } };
                })
            ];
        });

        return id;
    };

    const updateQuote = async (id: string, updates: Partial<LocalQuote>) => {
        // Get the current quote to ensure we have the opportunity_id
        const currentQuote = await db.quotes.get(id);
        if (!currentQuote) {
            console.warn('[updateQuote] Quote not found:', id);
            return;
        }

        const updatedQuote = { ...currentQuote, ...updates, updated_at: new Date().toISOString() };
        let updatedOpp: LocalOportunidad | null = null;
        if (updates.segmento_id !== undefined && currentQuote.opportunity_id) {
            const opp = await db.opportunities.get(currentQuote.opportunity_id);
            if (opp && opp.segmento_id !== updates.segmento_id) {
                updatedOpp = { ...opp, segmento_id: updates.segmento_id, updated_at: new Date().toISOString() };
            }
        }

        await syncEngine.commitLocalChanges([db.quotes, db.opportunities], async () => {
            await db.quotes.put(updatedQuote);
            if (updatedOpp) await db.opportunities.put(updatedOpp);
            return [
                { entityTable: 'CRM_Cotizaciones', entityId: id, changes: updatedQuote, options: { isSnapshot: true } },
                ...(updatedOpp ? [{
                    entityTable: 'CRM_Oportunidades', entityId: updatedOpp.id,
                    changes: sanitizeOpportunityForSync(updatedOpp), options: { isSnapshot: true }
                }] : [])
            ];
        });
    };

    const updateQuoteTotal = async (quoteId: string) => {
        const items = await db.quoteItems.where('cotizacion_id').equals(quoteId).toArray();
        const total = items.reduce((acc, curr) => acc + ((curr.final_unit_price || curr.precio_unitario) * curr.cantidad), 0);
        await updateQuote(quoteId, { total_amount: total });
    };

    const markAsWinner = async (quoteId: string) => {
        const quote = await db.quotes.get(quoteId);
        if (!quote) throw new Error("Cotización no encontrada");

        // 1. Mark this as WINNER
        await updateQuote(quoteId, { status: 'WINNER', is_winner: true });

        // 2. Mark others as REJECTED
        const otherQuotes = await db.quotes
            .where('opportunity_id').equals(quote.opportunity_id)
            .filter(q => q.id !== quoteId)
            .toArray();

        for (const q of otherQuotes) {
            await updateQuote(q.id, { status: 'REJECTED', is_winner: false });
        }

        // 3. Update parent opportunity amount to match winner quote
        await performOpportunityUpdate(quote.opportunity_id, { amount: quote.total_amount });

        // 4. Queue for SAP Integration
        const sapQueueId = uuidv4();
        const sapEntry = {
            id: sapQueueId,
            entity_type: 'CRM_Cotizaciones',
            entity_id: quoteId,
            payload: quote, // Send full quote data
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        // We queue this mutation to syncing engine so it reaches the server
        await syncEngine.queueMutation('CRM_SapIntegrationQueue', sapQueueId, sapEntry);
    };

    const deleteQuote = async (id: string) => {
        const quote = await db.quotes.get(id);
        if (!quote) return;

        const items = await db.quoteItems.where('cotizacion_id').equals(id).toArray();
        await syncEngine.commitLocalChanges([db.quotes, db.quoteItems], async () => {
            if (items.length > 0) await db.quoteItems.bulkDelete(items.map(item => item.id));
            await db.quotes.delete(id);
            return [
                ...items.map(item => {
                    const { subtotal, ...itemData } = item;
                    return { entityTable: 'CRM_CotizacionItems', entityId: item.id, changes: { ...itemData, is_deleted: true }, options: { isSnapshot: true } };
                }),
                { entityTable: 'CRM_Cotizaciones', entityId: id, changes: { ...quote, is_deleted: true }, options: { isSnapshot: true } }
            ];
        });
    };

    return { quotes, createQuote, updateQuote, updateQuoteTotal, markAsWinner, deleteQuote };
}

export function useQuoteItems(quoteId?: string) {
    const items = useLiveQuery(
        () => quoteId
            ? db.quoteItems.where('cotizacion_id').equals(quoteId).toArray()
            : [],
        [quoteId]
    );

    const addItem = async (quoteId: string, item: Omit<LocalQuoteItem, 'id' | 'cotizacion_id'>) => {
        const id = uuidv4();
        // Fetch Pricing
        let unitPrice = item.precio_unitario; // Default to what is passed if logic fails
        let maxDiscount = 0;

        try {
            const parentQuote = await db.quotes.get(quoteId);
            if (parentQuote) {
                const opp = await db.opportunities.get(parentQuote.opportunity_id);
                if (opp && opp.account_id) {
                    const acc = await db.accounts.get(opp.account_id);
                    if (acc) {
                        const channelId = acc.canal_id || 'DIST_NAC';

                        // 1. Fetch Full Product Data (Prices columns) + RPC for volume discount
                        // Import dynamically to avoid circular deps if needed, or just use global supabase
                        const { data: prodData } = await supabase
                            .from('CRM_ListaDePrecios')
                            .select('id, numero_articulo, lista_base_cop, lista_base_exportaciones, lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva')
                            .eq('id', item.producto_id)
                            .single();

                        if (prodData) {
                            // Apply Strict Logic — Number() needed because Supabase returns numeric(x,y) as strings
                            switch (channelId) {
                                case 'OBRAS_NAC':
                                    unitPrice = Number(prodData.lista_base_obras) || 0;
                                    break;
                                case 'OBRAS_INT':
                                case 'DIST_INT':
                                    unitPrice = Number(prodData.lista_base_exportaciones) || 0;
                                    break;
                                case 'PROPIO':
                                    unitPrice = Number(prodData.distribuidor_pvp_iva) || 0;
                                    break;
                                case 'DIST_NAC':
                                default:
                                    unitPrice = Number(prodData.lista_base_cop) || 0;
                            }
                            // Fallback robusto: lista_base_cop → pvp_sin_iva
                            if (unitPrice === 0) unitPrice = Number(prodData.lista_base_cop) || Number(prodData.pvp_sin_iva) || 0;

                            // 2. Fetch Volume Discount Limit via RPC
                            const { data: pricing } = await supabase.rpc('get_recommended_pricing', {
                                p_numero_articulo: prodData.numero_articulo,
                                p_canal_id: channelId,
                                p_qty: item.cantidad
                            });

                            if (pricing) {
                                maxDiscount = pricing.discount_pct;
                            }
                        }
                    }
                }
            }
        } catch (e) { console.error("Pricing calc error", e); }

        const discount = 0;
        const finalPrice = parseFloat((unitPrice * (1 - discount / 100)).toFixed(10));

        const newItem: LocalQuoteItem = {
            ...item,
            id,
            cotizacion_id: quoteId,
            precio_unitario: unitPrice,
            discount_pct: discount,
            max_discount_pct: maxDiscount,
            final_unit_price: finalPrice,
            subtotal: parseFloat((item.cantidad * finalPrice).toFixed(10))
        };
        const { subtotal, ...itemData } = newItem;
        
        // Defensive check: Ensure required fields are not null for server constraints
        if (!itemData.cotizacion_id || itemData.cotizacion_id === "null") {
            throw new Error('No se puede guardar un ítem sin cotización asociada.');
        }

        const parentQuote = await db.quotes.get(quoteId);
        const quoteUpdate = parentQuote ? { ...parentQuote, updated_at: new Date().toISOString() } : null;
        await syncEngine.commitLocalChanges([db.quoteItems, db.quotes], async () => {
            await db.quoteItems.add(newItem);
            if (quoteUpdate) await db.quotes.put(quoteUpdate);
            return [
                { entityTable: 'CRM_CotizacionItems', entityId: id, changes: itemData, options: { isSnapshot: true } },
                ...(quoteUpdate ? [{ entityTable: 'CRM_Cotizaciones', entityId: quoteId, changes: quoteUpdate, options: { isSnapshot: true } }] : [])
            ];
        });
    };

    const updateItem = async (itemId: string, updates: Partial<LocalQuoteItem>) => {
        const current = await db.quoteItems.get(itemId);
        if (!current) return;

        const updated = { ...current, ...updates };

        // If quantity changed, re-calculate pricing ONLY for linked products
        if (updates.cantidad !== undefined && updates.cantidad !== current.cantidad && current.producto_id) {
            let pricing = null;
            try {
                const parentQuote = await db.quotes.get(current.cotizacion_id);
                if (parentQuote) {
                    const opp = await db.opportunities.get(parentQuote.opportunity_id);
                    if (opp && opp.account_id) {
                        const acc = await db.accounts.get(opp.account_id);
                        if (acc) {
                            pricing = await fetchPricing(current.producto_id, acc.canal_id, updated.cantidad);
                        }
                    }
                }
            } catch (e) {
                console.error("[useQuoteItems] Error fetching pricing for update:", e);
            }

            if (pricing && pricing.base_price > 0) {
                // ONLY update base price if we got a valid non-zero price
                updated.precio_unitario = pricing.base_price;
                updated.max_discount_pct = pricing.discount_pct;

                // Cap existing manual discount if it now exceeds the new maximum allowed
                const manualDiscount = updated.discount_pct !== undefined ? updated.discount_pct : (current.discount_pct || 0);
                if (manualDiscount > pricing.discount_pct) {
                    updated.discount_pct = pricing.discount_pct;
                }
            }
        }

        // Recalc subtotal if anything changed
        // Ensure we rely on updated fields or fallbacks from current/record
        const currentPrice = updated.precio_unitario !== undefined ? updated.precio_unitario : (current.precio_unitario || 0);
        const currentDiscount = updated.discount_pct !== undefined ? updated.discount_pct : (current.discount_pct || 0);

        // ALWAYS recalculate final unit price to ensure consistency
        // Use toFixed(10) to eliminate IEEE 754 floating point noise (e.g., 7589.400000000001)
        updated.final_unit_price = parseFloat((currentPrice * (1 - currentDiscount / 100)).toFixed(10));
        updated.subtotal = parseFloat((updated.cantidad * updated.final_unit_price).toFixed(10));

        const { subtotal, ...updateData } = updated;
        const parentQuote = await db.quotes.get(current.cotizacion_id);
        const quoteUpdate = parentQuote ? { ...parentQuote, updated_at: new Date().toISOString() } : null;
        await syncEngine.commitLocalChanges([db.quoteItems, db.quotes], async () => {
            await db.quoteItems.put(updated);
            if (quoteUpdate) await db.quotes.put(quoteUpdate);
            return [
                { entityTable: 'CRM_CotizacionItems', entityId: itemId, changes: updateData, options: { isSnapshot: true } },
                ...(quoteUpdate ? [{ entityTable: 'CRM_Cotizaciones', entityId: current.cotizacion_id, changes: quoteUpdate, options: { isSnapshot: true } }] : [])
            ];
        });
    };

    const removeItem = async (itemId: string) => {
        const current = await db.quoteItems.get(itemId);
        if (!current) return;

        const { subtotal, ...itemData } = current;
        const parentQuote = await db.quotes.get(current.cotizacion_id);
        const quoteUpdate = parentQuote ? { ...parentQuote, updated_at: new Date().toISOString() } : null;
        await syncEngine.commitLocalChanges([db.quoteItems, db.quotes], async () => {
            await db.quoteItems.delete(itemId);
            if (quoteUpdate) await db.quotes.put(quoteUpdate);
            return [
                { entityTable: 'CRM_CotizacionItems', entityId: itemId, changes: { ...itemData, is_deleted: true }, options: { isSnapshot: true } },
                ...(quoteUpdate ? [{ entityTable: 'CRM_Cotizaciones', entityId: current.cotizacion_id, changes: quoteUpdate, options: { isSnapshot: true } }] : [])
            ];
        });
    };

    return { items, addItem, updateItem, removeItem };
}
