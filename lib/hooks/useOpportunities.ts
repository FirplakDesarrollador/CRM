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
        const newOpp = { ...oppData, items, id, updated_at: new Date().toISOString() };

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
            // Queuing bulk items might need server-side bulk support, 
            // for now simulation: queue each
            for (const qi of quoteItems) {
                await syncEngine.queueMutation('CRM_CotizacionItems', qi.id, qi);
            }
        }
    };

    const generateMockData = async () => {
        const mocks = [
            {
                id: uuidv4(),
                nombre: "Reforma Oficinas Centrales",
                amount: 45000000,
                currency_id: "COP",
                fase: "Negociación",
                owner_user_id: "user-123", // Mine
                status: "OPEN",
                updated_at: new Date().toISOString()
            },
            {
                id: uuidv4(),
                nombre: "Dotación Baños CC",
                amount: 12000,
                currency_id: "USD",
                fase: "Propuesta",
                owner_user_id: "user-999", // Other
                status: "OPEN",
                updated_at: new Date().toISOString()
            },
            {
                id: uuidv4(),
                nombre: "Proyecto Residencial Altos",
                amount: 85000000,
                currency_id: "COP",
                fase: "Prospecto",
                owner_user_id: "user-999", // Other
                status: "OPEN",
                updated_at: new Date().toISOString()
            }
        ];
        await db.opportunities.bulkAdd(mocks);
    };

    const deleteOpportunity = async (id: string) => {
        await db.opportunities.delete(id);
        await syncEngine.queueMutation('CRM_Oportunidades', id, { is_deleted: true });
    };

    return { opportunities, createOpportunity, generateMockData, deleteOpportunity };
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

        const newQuote: LocalQuote = {
            id,
            opportunity_id: oppId,
            numero_cotizacion: `COT-${Date.now().toString().slice(-6)}`,
            status: 'DRAFT',
            total_amount: latestQuote?.total_amount || 0,
            currency_id: latestQuote?.currency_id || opportunity?.currency_id || 'COP',
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
                await syncEngine.queueMutation('CRM_CotizacionItems', ni.id, ni);
            }
        }

        return id;
    };

    const updateQuote = async (id: string, updates: Partial<LocalQuote>) => {
        await db.quotes.update(id, updates);
        await syncEngine.queueMutation('CRM_Cotizaciones', id, updates);
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
        await syncEngine.queueMutation('CRM_CotizacionItems', id, newItem);
    };

    const updateItem = async (itemId: string, updates: Partial<LocalQuoteItem>) => {
        const current = await db.quoteItems.get(itemId);
        if (!current) return;

        const updated = { ...current, ...updates };
        updated.subtotal = updated.cantidad * updated.precio_unitario;

        await db.quoteItems.update(itemId, updated);
        await syncEngine.queueMutation('CRM_CotizacionItems', itemId, updated);
    };

    const removeItem = async (itemId: string) => {
        await db.quoteItems.delete(itemId);
        await syncEngine.queueMutation('CRM_CotizacionItems', itemId, { is_deleted: true });
    };

    return { items, addItem, updateItem, removeItem };
}
