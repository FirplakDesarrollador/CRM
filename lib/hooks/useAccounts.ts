import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalCuenta } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

export function useAccounts() {
    const { user, isVendedor } = useCurrentUser();
    const userId = user?.id;

    // Live Query from Local DB (Dexie)
    const accounts = useLiveQuery(async () => {
        const allAccounts = await db.accounts.toArray();
        if (isVendedor && userId) {
            return allAccounts.filter((a: any) => a.owner_user_id === userId);
        }
        return allAccounts;
    }, [isVendedor, userId]);
    const isLoading = false; // Background sync handles loading

    const createAccount = async (data: Partial<LocalCuenta>) => {
        const id = crypto.randomUUID();
        const { data: { user } } = await supabase.auth.getUser();

        // Defensive conversion: ensure numeric IDs are numbers, not strings from form
        const sanitizedData = {
            ...data,
            subclasificacion_id: data.subclasificacion_id ? Number(data.subclasificacion_id) : null,
            departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
            ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null
        };

        const newAccount = {
            ...sanitizedData,
            id,
            created_by: user?.id,
            owner_user_id: user?.id,
            updated_at: new Date().toISOString()
        };
        await db.accounts.add(newAccount as LocalCuenta);
        await syncEngine.queueMutation('CRM_Cuentas', id, sanitizedData);

        // AUTO-CREATE CONTACT FOR 'PROPIO' CHANNEL
        if (sanitizedData.canal_id === 'PROPIO') {
            const contactId = crypto.randomUUID();
            const contactData = {
                id: contactId,
                account_id: id,
                nombre: sanitizedData.nombre || 'Cliente',
                cargo: 'Cliente final',
                telefono: sanitizedData.telefono || null,
                email: (sanitizedData as any).email || null,
                es_principal: true,
                created_by: user?.id,
                updated_by: user?.id,
                updated_at: new Date().toISOString()
            };
            await db.contacts.add(contactData as any);
            await syncEngine.queueMutation('CRM_Contactos', contactId, contactData);
            console.log('[useAccounts] Auto-created contact for PROPIO account:', contactId);
        }
    };


    const updateAccount = async (id: string, updates: Partial<LocalCuenta>) => {
        console.log('[useAccounts] DEBUG - updateAccount called with:', { id, updates });

        // Defensive conversion: ensure numeric IDs are numbers, not strings from form
        const sanitizedUpdates = {
            ...updates,
            subclasificacion_id: updates.subclasificacion_id ? Number(updates.subclasificacion_id) : null,
            departamento_id: updates.departamento_id ? Number(updates.departamento_id) : null,
            ciudad_id: updates.ciudad_id ? Number(updates.ciudad_id) : null
        };

        console.log('[useAccounts] DEBUG - subclasificacion_id sanitized:', sanitizedUpdates.subclasificacion_id);
        const fullUpdates = { ...sanitizedUpdates, updated_at: new Date().toISOString() };
        await db.accounts.update(id, fullUpdates);
        console.log('[useAccounts] DEBUG - Calling syncEngine.queueMutation with updates:', sanitizedUpdates);
        await syncEngine.queueMutation('CRM_Cuentas', id, sanitizedUpdates);
        console.log('[useAccounts] DEBUG - queueMutation completed');
    };

    const deleteAccount = async (id: string) => {
        console.log('[useAccounts] deleteAccount - Starting cascade delete for:', id);

        // 1. Delete Contacts associated with this account (server-side)
        const { data: contacts } = await supabase.from('CRM_Contactos').select('id').eq('account_id', id);
        if (contacts && contacts.length > 0) {
            const contactIds = contacts.map(c => c.id);
            await supabase.from('CRM_Contactos').update({ is_deleted: true }).in('id', contactIds);
            console.log('[useAccounts] Deleted contacts:', contactIds.length);
        }

        // 2. Get Opportunities associated with this account
        const { data: opportunities } = await supabase.from('CRM_Oportunidades').select('id').eq('account_id', id);
        if (opportunities && opportunities.length > 0) {
            const oppIds = opportunities.map(o => o.id);

            // 3. Delete Activities associated with these opportunities
            await supabase.from('CRM_Actividades').update({ is_deleted: true }).in('opportunity_id', oppIds);

            // 4. Get Quotes associated with these opportunities
            const { data: quotes } = await supabase.from('CRM_Cotizaciones').select('id').in('opportunity_id', oppIds);
            if (quotes && quotes.length > 0) {
                const quoteIds = quotes.map(q => q.id);

                // 5. Delete Quote Items
                await supabase.from('CRM_CotizacionItems').update({ is_deleted: true }).in('cotizacion_id', quoteIds);

                // 6. Delete Quotes
                await supabase.from('CRM_Cotizaciones').update({ is_deleted: true }).in('id', quoteIds);
            }

            // 7. Delete Opportunities
            await supabase.from('CRM_Oportunidades').update({ is_deleted: true }).in('id', oppIds);
            console.log('[useAccounts] Deleted opportunities:', oppIds.length);
        }

        // 8. Finally Delete the Account itself
        const { error } = await supabase.from('CRM_Cuentas').update({ is_deleted: true }).eq('id', id);
        if (error) {
            console.error('[useAccounts] Error deleting account:', error);
            throw error;
        }

        // Also remove from local Dexie DB for offline consistency
        await db.accounts.delete(id);
        console.log('[useAccounts] Account deleted successfully:', id);
    };

    return {
        accounts: accounts || [],
        isLoading,
        createAccount,
        updateAccount,
        deleteAccount
    };
}
