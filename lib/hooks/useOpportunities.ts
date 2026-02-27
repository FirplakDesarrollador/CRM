import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalQuote, LocalQuoteItem } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';

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

    return sanitized;
}

export function useOpportunities() {
    const opportunities = useLiveQuery(() => db.opportunities.toArray());

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
            created_by: user?.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };
        await db.opportunities.add(newOpp);
        await syncEngine.queueMutation('CRM_Oportunidades', id, sanitizeOpportunityForSync(newOpp));

        // Save Collaborators (Defensive)
        if (collaborators && collaborators.length > 0) {
            try {
                const collabEntries = collaborators.map((c: any) => ({
                    id: uuidv4(),
                    oportunidad_id: id,
                    usuario_id: c.usuario_id,
                    porcentaje: c.porcentaje,
                    rol: c.rol || 'COLABORADOR',
                    created_at: new Date().toISOString()
                }));

                await db.opportunityCollaborators.bulkAdd(collabEntries);
                for (const col of collabEntries) {
                    await syncEngine.queueMutation('CRM_Oportunidades_Colaboradores', col.id, col);
                }
            } catch (err) {
                console.warn("Could not save collaborators locally or queue mutation (table might be missing locally):", err);
            }
        }

        // If items are present, create an initial quote
        if (items && items.length > 0) {
            const quoteId = uuidv4();
            const newQuote: LocalQuote = {
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

            await db.quotes.add(newQuote);
            await syncEngine.queueMutation('CRM_Cotizaciones', quoteId, newQuote);

            // Add items
            // Add items with calculated pricing
            const account = await db.accounts.get(oppData.account_id);
            const channelId = account?.canal_id || 'DIST_NAC';

            const quoteItems: LocalQuoteItem[] = await Promise.all(items.map(async (item: any) => {
                // We rely on the Wizard to have picked the correct base price (item.precio) based on channel
                // We ONLY call fetchPricing to retrieve the VOLUME LIMIT (max_discount_pct) if available.
                // We ignore the RPC's base_price to avoid overwriting the specific column logic.
                const pricing = await fetchPricing(item.product_id, channelId, item.cantidad);

                // Pricing Logic:
                // unitPrice = Trusted from Wizard (item.precio)
                // maxDiscount = From RPC (volume limit)
                const unitPrice = item.precio || (pricing ? pricing.base_price : 0);
                const maxDiscount = pricing ? pricing.discount_pct : 0;

                const discount = 0; // Default to 0 manual discount
                const finalPrice = unitPrice * (1 - discount / 100);

                return {
                    id: uuidv4(),
                    cotizacion_id: quoteId,
                    producto_id: item.product_id,
                    cantidad: item.cantidad,
                    precio_unitario: unitPrice,
                    discount_pct: discount,
                    max_discount_pct: maxDiscount,
                    final_unit_price: finalPrice,
                    subtotal: item.cantidad * finalPrice,
                    descripcion_linea: item.nombre
                };
            }));

            await db.quoteItems.bulkAdd(quoteItems);
            for (const qi of quoteItems) {
                const { subtotal, ...qiData } = qi;
                await syncEngine.queueMutation('CRM_CotizacionItems', qi.id, qiData);
            }
        }
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

        await db.opportunities.delete(id);

        // Include full row data to satisfy NOT NULL constraints on server if it's an upsert-style sync
        await syncEngine.queueMutation('CRM_Oportunidades', id, sanitizeOpportunityForSync({
            ...current,
            is_deleted: true
        }));
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

        await db.opportunities.update(id, updated);

        // Prepare partial payload with mandatory NOT NULL fields for UPSERT safety
        const syncPayload: any = sanitizeOpportunityForSync(sanitizedUpdates);
        if (updates.fecha_cierre_estimada !== undefined) syncPayload.fecha_cierre_estimada = updated.fecha_cierre_estimada;

        syncPayload.nombre = updated.nombre;
        syncPayload.account_id = updated.account_id;
        syncPayload.fase_id = updated.fase_id;
        syncPayload.moneda_id = updated.moneda_id;
        syncPayload.owner_user_id = updated.owner_user_id;

        await syncEngine.queueMutation('CRM_Oportunidades', id, syncPayload);

        // PROPAGATION: If segmento_id changed, update all associated quotes
        if (updates.segmento_id !== undefined) {
            const quotes = await db.quotes.where('opportunity_id').equals(id).toArray();
            for (const q of quotes) {
                if (q.segmento_id !== updates.segmento_id) {
                    const updatedQuote = { ...q, segmento_id: updates.segmento_id, updated_at: new Date().toISOString() };
                    await db.quotes.update(q.id, updatedQuote);
                    await syncEngine.queueMutation('CRM_Cotizaciones', q.id, updatedQuote);
                }
            }
        }
    };

    return { opportunities, createOpportunity, generateMockData, deleteOpportunity, updateOpportunity };
}

// Internal version to be used by other hooks without hook dependency issues
async function performOpportunityUpdate(id: string, updates: any) {
    const current = await db.opportunities.get(id);
    if (!current) return;

    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    await db.opportunities.update(id, updated);

    // Prepare partial payload with mandatory NOT NULL fields
    const syncPayload: any = sanitizeOpportunityForSync(updates);
    syncPayload.nombre = updated.nombre;
    syncPayload.account_id = updated.account_id;
    syncPayload.fase_id = updated.fase_id;
    syncPayload.moneda_id = updated.moneda_id;
    syncPayload.owner_user_id = updated.owner_user_id;

    await syncEngine.queueMutation('CRM_Oportunidades', id, syncPayload);
}


export function useQuotes(opportunityId?: string) {
    const quotes = useLiveQuery(
        () => opportunityId
            ? db.quotes.where('opportunity_id').equals(opportunityId).toArray()
            : db.quotes.toArray(),
        [opportunityId]
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

        await db.quotes.add(newQuote);
        await syncEngine.queueMutation('CRM_Cotizaciones', id, newQuote);

        // Save items
        if (inheritedItems.length > 0) {
            const newItems: LocalQuoteItem[] = inheritedItems.map((item: any) => ({
                id: uuidv4(),
                cotizacion_id: id,
                producto_id: item.product_id || item.producto_id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario || item.precio || 0,
                discount_pct: item.discount_pct || 0,
                final_unit_price: item.final_unit_price || item.precio_unitario || 0,
                subtotal: (item.cantidad * (item.final_unit_price || item.precio_unitario || item.precio || 0)),
                descripcion_linea: item.descripcion_linea || item.nombre
            }));

            await db.quoteItems.bulkAdd(newItems);
            for (const ni of newItems) {
                const { subtotal, ...niData } = ni;
                await syncEngine.queueMutation('CRM_CotizacionItems', ni.id, niData);
            }
        }

        return id;
    };

    const updateQuote = async (id: string, updates: Partial<LocalQuote>) => {
        // Get the current quote to ensure we have the opportunity_id
        const currentQuote = await db.quotes.get(id);
        if (!currentQuote) {
            console.warn('[updateQuote] Quote not found:', id);
            return;
        }

        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        await db.quotes.update(id, fullUpdates);

        // Include opportunity_id in the sync payload to avoid constraint violations
        const syncPayload = {
            ...fullUpdates,
            opportunity_id: currentQuote.opportunity_id,
        };
        await syncEngine.queueMutation('CRM_Cotizaciones', id, syncPayload);

        // PROPAGATION: If segmento_id changed, update the parent opportunity
        if (updates.segmento_id !== undefined && currentQuote.opportunity_id) {
            const opp = await db.opportunities.get(currentQuote.opportunity_id);
            if (opp && opp.segmento_id !== updates.segmento_id) {
                const updatedOpp = { ...opp, segmento_id: updates.segmento_id, updated_at: new Date().toISOString() };
                await db.opportunities.update(opp.id, updatedOpp);
                await syncEngine.queueMutation('CRM_Oportunidades', opp.id, updatedOpp);
            }
        }
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

        // 1. Delete Items
        const items = await db.quoteItems.where('cotizacion_id').equals(id).toArray();
        for (const item of items) {
            await db.quoteItems.delete(item.id);
            const { subtotal, ...itemData } = item;
            await syncEngine.queueMutation('CRM_CotizacionItems', item.id, {
                ...itemData,
                is_deleted: true
            });
        }

        // 2. Delete Quote
        await db.quotes.delete(id);
        await syncEngine.queueMutation('CRM_Cotizaciones', id, {
            ...quote,
            is_deleted: true
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
                            // Apply Strict Logic
                            switch (channelId) {
                                case 'OBRAS_NAC':
                                    unitPrice = prodData.lista_base_obras || 0;
                                    break;
                                case 'OBRAS_INT':
                                case 'DIST_INT':
                                    unitPrice = prodData.lista_base_exportaciones || 0;
                                    break;
                                case 'PROPIO':
                                    unitPrice = prodData.distribuidor_pvp_iva || 0;
                                    break;
                                case 'DIST_NAC':
                                default:
                                    unitPrice = prodData.lista_base_cop || 0;
                            }
                            if (unitPrice === 0) unitPrice = prodData.lista_base_cop || 0; // Fallback

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
        const finalPrice = unitPrice * (1 - discount / 100);

        const newItem: LocalQuoteItem = {
            ...item,
            id,
            cotizacion_id: quoteId,
            precio_unitario: unitPrice,
            discount_pct: discount,
            max_discount_pct: maxDiscount,
            final_unit_price: finalPrice,
            subtotal: item.cantidad * finalPrice
        };
        await db.quoteItems.add(newItem);
        const { subtotal, ...itemData } = newItem;
        await syncEngine.queueMutation('CRM_CotizacionItems', id, itemData);

        // Touch parent quote with opportunity_id
        const parentQuote = await db.quotes.get(quoteId);
        if (parentQuote) {
            const quoteUpdate = { updated_at: new Date().toISOString() };
            await db.quotes.update(quoteId, quoteUpdate);
            await syncEngine.queueMutation('CRM_Cotizaciones', quoteId, {
                ...quoteUpdate,
                opportunity_id: parentQuote.opportunity_id
            });
        }
    };

    const updateItem = async (itemId: string, updates: Partial<LocalQuoteItem>) => {
        const current = await db.quoteItems.get(itemId);
        if (!current) return;

        const updated = { ...current, ...updates };

        // If quantity changed, re-calculate pricing? 
        // Plan says: "no recalcular automáticamente líneas existentes si luego cambian descuentos/listas"
        // But usually if I change QTY, volume discount SHOULD update.
        // Let's implement Recalc on Quantity change for best UX
        if (updates.cantidad !== undefined && updates.cantidad !== current.cantidad) {
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
        updated.final_unit_price = currentPrice * (1 - currentDiscount / 100);
        updated.subtotal = updated.cantidad * updated.final_unit_price;

        await db.quoteItems.update(itemId, updated);
        const { subtotal, ...updateData } = updated;
        await syncEngine.queueMutation('CRM_CotizacionItems', itemId, updateData);

        // Touch parent quote with opportunity_id
        const parentQuote = await db.quotes.get(current.cotizacion_id);
        if (parentQuote) {
            const quoteUpdate = { updated_at: new Date().toISOString() };
            await db.quotes.update(current.cotizacion_id, quoteUpdate);
            await syncEngine.queueMutation('CRM_Cotizaciones', current.cotizacion_id, {
                ...quoteUpdate,
                opportunity_id: parentQuote.opportunity_id
            });
        }
    };

    const removeItem = async (itemId: string) => {
        const current = await db.quoteItems.get(itemId);
        if (!current) return;

        await db.quoteItems.delete(itemId);

        // Include ALL item data + is_deleted to match DB constraints during sync (upsert)
        const { subtotal, ...itemData } = current;
        await syncEngine.queueMutation('CRM_CotizacionItems', itemId, {
            ...itemData,
            is_deleted: true
        });

        // Touch parent quote with opportunity_id
        if (current) {
            const parentQuote = await db.quotes.get(current.cotizacion_id);
            if (parentQuote) {
                const quoteUpdate = { updated_at: new Date().toISOString() };
                await db.quotes.update(current.cotizacion_id, quoteUpdate);
                await syncEngine.queueMutation('CRM_Cotizaciones', current.cotizacion_id, {
                    ...quoteUpdate,
                    opportunity_id: parentQuote.opportunity_id
                });
            }
        }
    };

    return { items, addItem, updateItem, removeItem };
}
