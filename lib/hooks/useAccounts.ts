import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalCuenta } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

export function useAccounts(filters?: { advisor_id?: string | null, showAll?: boolean }) {
    const { user, isVendedor } = useCurrentUser();
    const userId = user?.id;

    // Live Query from Local DB (Dexie)
    const accounts = useLiveQuery(async () => {
        // Priority 1: Specific advisor filter from Dashboard
        if (filters?.advisor_id) {
            return db.accounts.where('owner_user_id').equals(filters.advisor_id).toArray();
        }

        // Priority 2: Global visibility (for Opportunity Wizard)
        if (filters?.showAll) {
            return db.accounts.toArray();
        }

        // Priority 3: Vendedor role restriction
        if (isVendedor && userId) {
            return db.accounts.filter(a => 
                a.owner_user_id === userId || 
                (!a.owner_user_id && a.created_by === userId)
            ).toArray();
        }

        return db.accounts.toArray();
    }, [isVendedor, userId, filters?.advisor_id, filters?.showAll]);
    const isLoading = false; // Background sync handles loading

    const createAccount = async (data: Partial<LocalCuenta>, initialContactData?: {
        nombre?: string;
        cargo?: string;
        telefono?: string | null;
        email?: string | null;
        comentarios?: string;
    }) => {
        const id = crypto.randomUUID();
        const { data: { user } } = await supabase.auth.getUser();

        const toNum = (val: any) => (val !== undefined && val !== null && val !== "") ? Number(val) : null;

        // Local duplicate check before inserting
        if (data.nit_base) {
            const existingLocal = await db.accounts
                .where('nit_base')
                .equals(data.nit_base)
                .toArray();
            
            // Allow child accounts (sucursales) to share NIT
            if (existingLocal.length > 0 && !data.is_child) {
                throw new Error(`Ya existe una cuenta localmente con el NIT ${data.nit_base}`);
            }
        }

        const sanitizedData = {
            ...data,
            subclasificacion_id: toNum(data.subclasificacion_id),
            departamento_id: toNum(data.departamento_id),
            ciudad_id: toNum(data.ciudad_id),
            pais_id: toNum(data.pais_id)
        };

        const newAccount = {
            ...sanitizedData,
            id,
            created_by: user?.id,
            owner_user_id: data.owner_user_id || user?.id,
            updated_at: new Date().toISOString()
        };
        await db.accounts.add(newAccount as LocalCuenta);
        await syncEngine.queueMutation('CRM_Cuentas', id, newAccount, { isSnapshot: true });

        // AUTO-CREATE CONTACT FOR 'PROPIO' CHANNEL
        if (sanitizedData.canal_id === 'PROPIO') {
            const contactId = crypto.randomUUID();
            const contactData = {
                id: contactId,
                account_id: id,
                nombre: initialContactData?.nombre?.trim() || sanitizedData.nombre || 'Cliente',
                cargo: initialContactData?.cargo?.trim() || 'Cliente final',
                telefono: initialContactData?.telefono?.trim() || sanitizedData.telefono || null,
                email: initialContactData?.email?.trim() || (sanitizedData as any).email || null,
                comentarios: initialContactData?.comentarios?.trim() || undefined,
                es_principal: true,
                created_by: user?.id,
                updated_by: user?.id,
                updated_at: new Date().toISOString()
            };
            await db.contacts.add(contactData as any);
            await syncEngine.queueMutation('CRM_Contactos', contactId, contactData, { isSnapshot: true });
            console.log('[useAccounts] Auto-created contact for PROPIO account:', contactId);
        }

        return id;
    };


    const updateAccount = async (id: string, updates: Partial<LocalCuenta>) => {
        console.log('[useAccounts] DEBUG - updateAccount original updates:', JSON.stringify(updates));

        // Defensive conversion: ensure numeric IDs are numbers, not strings from form
        const { _sync_metadata, ...sanitized } = updates;
        
        const toNum = (val: any) => (val !== undefined && val !== null && val !== "") ? Number(val) : null;
        
        // Ensure email and telefono are preserved even if they are null strings
        const sanitizedUpdates: any = {
            ...sanitized,
            subclasificacion_id: toNum((updates as any).subclasificacion_id),
            departamento_id: toNum((updates as any).departamento_id),
            ciudad_id: toNum((updates as any).ciudad_id),
            pais_id: toNum((updates as any).pais_id),
            telefono: (updates as any).telefono !== undefined ? (updates as any).telefono : sanitized.telefono,
            email: (updates as any).email !== undefined ? (updates as any).email : (sanitized as any).email
        };

        console.log('[useAccounts] DEBUG - sanitizedUpdates result:', JSON.stringify(sanitizedUpdates));
        
        const currentLocal = await db.accounts.get(id);
        const fullUpdates = { ...sanitizedUpdates, updated_at: new Date().toISOString() };
        await db.accounts.update(id, fullUpdates);
        
        const mergedRecord = { ...currentLocal, ...fullUpdates } as LocalCuenta;
        console.log('[useAccounts] DEBUG - Queuing mutation for sync (Atomic Snapshot):', mergedRecord);
        await syncEngine.queueMutation('CRM_Cuentas', id, mergedRecord, { isSnapshot: true });
    };

    const deleteAccount = async (id: string) => {
        console.log('[useAccounts] deleteAccount - Starting Local-First cascade delete for:', id);

        const currentAccount = await db.accounts.get(id);
        if (!currentAccount) return;

        // 1. Gather all local child entities from Dexie
        const contacts = await db.contacts.where('account_id').equals(id).toArray();
        const opportunities = await db.opportunities.where('account_id').equals(id).toArray();
        const oppIds = opportunities.map(o => o.id);

        let quotes: any[] = [];
        let quoteItems: any[] = [];
        let activities: any[] = [];
        let pedidos: any[] = [];
        let pedidoItems: any[] = [];

        if (oppIds.length > 0) {
            quotes = await db.quotes.where('opportunity_id').anyOf(oppIds).toArray();
            const quoteIds = quotes.map(q => q.id);
            if (quoteIds.length > 0) {
                quoteItems = await db.quoteItems.where('cotizacion_id').anyOf(quoteIds).toArray();
            }
            activities = await db.activities.where('opportunity_id').anyOf(oppIds).toArray();
            pedidos = await db.pedidos.where('opportunity_id').anyOf(oppIds).toArray();
            const pedidoUuids = pedidos.map(p => p.uuid_generado).filter(Boolean);
            if (pedidoUuids.length > 0) {
                pedidoItems = await db.pedidoItems.where('pedido_uuid').anyOf(pedidoUuids).toArray();
            }
        }

        // 2. Perform atomic local deletion in Dexie
        await db.transaction('rw', [
            db.accounts,
            db.contacts,
            db.opportunities,
            db.quotes,
            db.quoteItems,
            db.activities,
            db.pedidos,
            db.pedidoItems
        ], async () => {
            await db.accounts.delete(id);
            if (contacts.length > 0) await db.contacts.where('account_id').equals(id).delete();
            if (oppIds.length > 0) {
                await db.opportunities.where('account_id').equals(id).delete();
                await db.quotes.where('opportunity_id').anyOf(oppIds).delete();
                const quoteIds = quotes.map(q => q.id);
                if (quoteIds.length > 0) await db.quoteItems.where('cotizacion_id').anyOf(quoteIds).delete();
                await db.activities.where('opportunity_id').anyOf(oppIds).delete();
                await db.pedidos.where('opportunity_id').anyOf(oppIds).delete();
                const pedidoUuids = pedidos.map(p => p.uuid_generado).filter(Boolean);
                if (pedidoUuids.length > 0) await db.pedidoItems.where('pedido_uuid').anyOf(pedidoUuids).delete();
            }
        });

        console.log('[useAccounts] Local Dexie delete complete. Queueing outbox mutations...');

        // 3. Queue Soft Delete mutations for server sync
        await syncEngine.queueMutation('CRM_Cuentas', id, { ...currentAccount, is_deleted: true }, { isSnapshot: true });

        for (const contact of contacts) {
            await syncEngine.queueMutation('CRM_Contactos', contact.id, { ...contact, is_deleted: true }, { isSnapshot: true });
        }
        for (const opp of opportunities) {
            await syncEngine.queueMutation('CRM_Oportunidades', opp.id, { ...opp, is_deleted: true }, { isSnapshot: true });
        }
        for (const quote of quotes) {
            await syncEngine.queueMutation('CRM_Cotizaciones', quote.id, { ...quote, is_deleted: true }, { isSnapshot: true });
        }
        for (const item of quoteItems) {
            await syncEngine.queueMutation('CRM_CotizacionItems', item.id, { ...item, is_deleted: true }, { isSnapshot: true });
        }
        for (const act of activities) {
            await syncEngine.queueMutation('CRM_Actividades', act.id, { ...act, is_deleted: true }, { isSnapshot: true });
        }
        for (const ped of pedidos) {
            await syncEngine.queueMutation('CRM_Pedidos', ped.uuid_generado, { ...ped, is_deleted: true }, { isSnapshot: true });
        }
        for (const pItem of pedidoItems) {
            await syncEngine.queueMutation('CRM_PedidoItems', pItem.id, { ...pItem, is_deleted: true }, { isSnapshot: true });
        }

        console.log('[useAccounts] All server mutations queued successfully for offline delete.');
    };

    return {
        accounts: accounts || [],
        isLoading,
        createAccount,
        updateAccount,
        deleteAccount
    };
}
