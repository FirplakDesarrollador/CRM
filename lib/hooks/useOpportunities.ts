import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalQuote, LocalQuoteItem } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';

export function useOpportunities() {
    const opportunities = useLiveQuery(() => db.opportunities.toArray());

    const createOpportunity = async (data: any) => {
        const id = uuidv4();
        const { items, ...oppData } = data;

        // Fetch current user for ownership
        const { data: { user } } = await syncEngine.getCurrentUser();

        const newOpp = {
            ...oppData,
            items,
            id,
            owner_user_id: oppData.owner_user_id || user?.id,
            account_id: oppData.account_id,
            estado_id: oppData.estado_id || 1,
            fase_id: oppData.fase_id || 1,
            created_by: user?.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };

        await db.opportunities.add(newOpp);
        await syncEngine.queueMutation('CRM_Oportunidades', id, newOpp);

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
            const quoteItems: LocalQuoteItem[] = items.map((item: any) => ({
                id: uuidv4(),
                cotizacion_id: quoteId,
                producto_id: item.product_id,
                cantidad: item.cantidad,
                precio_unitario: item.precio,
                subtotal: item.cantidad * item.precio,
                descripcion_linea: item.nombre
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
                nombre: "Reforma Oficinas Centrales",
                amount: 45000000,
                currency_id: "COP",
                fase_id: "NEG",
                owner_user_id: userId,
                status: "OPEN",
                updated_at: new Date().toISOString()
            },
            {
                id: uuidv4(),
                nombre: "Dotación Baños CC",
                amount: 12000,
                currency_id: "USD",
                fase_id: "PROP",
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
        await syncEngine.queueMutation('CRM_Oportunidades', id, {
            ...current,
            is_deleted: true
        });
    };

    const updateOpportunity = async (id: string, updates: any) => {
        const current = await db.opportunities.get(id);
        if (!current) return;

        const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
        await db.opportunities.update(id, updated);

        // Send full opportunity data to satisfy NOT NULL constraints on server
        await syncEngine.queueMutation('CRM_Oportunidades', id, updated);
    };

    return { opportunities, createOpportunity, generateMockData, deleteOpportunity, updateOpportunity };
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
            currency_id: latestQuote?.currency_id || opportunity?.currency_id || 'COP',
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
                subtotal: (item.cantidad * (item.precio_unitario || item.precio || 0)),
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
    };

    const updateQuoteTotal = async (quoteId: string) => {
        const items = await db.quoteItems.where('cotizacion_id').equals(quoteId).toArray();
        const total = items.reduce((acc, curr) => acc + (curr.precio_unitario * curr.cantidad), 0);
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

        // 3. Queue for SAP Integration
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

    return { quotes, createQuote, updateQuote, updateQuoteTotal, markAsWinner };
}

export function useQuoteItems(quoteId?: string) {
    const items = useLiveQuery(
        () => quoteId
            ? db.quoteItems.where('cotizacion_id').equals(quoteId).toArray()
            : db.quoteItems.toArray(),
        [quoteId]
    );

    const addItem = async (quoteId: string, item: Omit<LocalQuoteItem, 'id' | 'cotizacion_id'>) => {
        const id = uuidv4();
        const newItem: LocalQuoteItem = {
            ...item,
            id,
            cotizacion_id: quoteId,
            subtotal: item.cantidad * item.precio_unitario
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
        updated.subtotal = updated.cantidad * updated.precio_unitario;

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
