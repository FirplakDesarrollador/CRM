import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalContact, LocalCuenta, LocalOportunidad } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { generateProvisionalNit, isProvisionalNit } from "@/lib/nitUtils";
import { sanitizeOpportunityForSync } from "@/lib/hooks/useOpportunities";

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

        // Asegurar que toda cuenta tenga un NIT (real o provisional generado)
        const finalNitBase = (data.nit_base && String(data.nit_base).trim() !== "" && data.nit_base !== "Sin NIT")
            ? String(data.nit_base).trim()
            : generateProvisionalNit();

        // Local duplicate check before inserting (para NITs reales no provisionales)
        if (finalNitBase && !isProvisionalNit(finalNitBase)) {
            const existingLocal = await db.accounts
                .where('nit_base')
                .equals(finalNitBase)
                .toArray();
            
            // Allow child accounts (sucursales) to share NIT
            if (existingLocal.length > 0 && !data.is_child) {
                throw new Error(`Ya existe una cuenta localmente con el NIT ${finalNitBase}`);
            }
        }

        const sanitizedData = {
            ...data,
            nit_base: finalNitBase,
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

        // AUTO-CREATE CONTACT FOR 'PROPIO' CHANNEL
        let contactData: LocalContact | null = null;
        if (sanitizedData.canal_id === 'PROPIO') {
            const contactId = crypto.randomUUID();
            contactData = {
                id: contactId,
                account_id: id,
                nombre: initialContactData?.nombre?.trim() || sanitizedData.nombre || 'Cliente',
                cargo: initialContactData?.cargo?.trim() || 'Cliente final',
                telefono: initialContactData?.telefono?.trim() || sanitizedData.telefono || undefined,
                email: initialContactData?.email?.trim() || (sanitizedData as Partial<LocalCuenta> & { email?: string }).email || undefined,
                comentarios: initialContactData?.comentarios?.trim() || undefined,
                es_principal: true,
                created_by: user?.id,
                updated_by: user?.id,
                updated_at: new Date().toISOString()
            };
        }

        await syncEngine.commitLocalChanges([db.accounts, db.contacts], async () => {
            await db.accounts.add(newAccount as LocalCuenta);
            if (contactData) await db.contacts.add(contactData);

            return [
                {
                    entityTable: 'CRM_Cuentas', entityId: id, changes: newAccount,
                    options: { isSnapshot: true }
                },
                ...(contactData ? [{
                    entityTable: 'CRM_Contactos', entityId: contactData.id, changes: contactData,
                    options: { isSnapshot: true }
                }] : [])
            ];
        });

        return id;
    };


    const updateAccount = async (id: string, updates: Partial<LocalCuenta>) => {
        console.log('[useAccounts] DEBUG - updateAccount original updates:', JSON.stringify(updates));

        // Defensive conversion: ensure numeric IDs are numbers, not strings from form
        const { _sync_metadata, ...sanitized } = updates;
        
        const toNum = (val: any) => (val !== undefined && val !== null && val !== "") ? Number(val) : null;

        let updatedNitBase = sanitized.nit_base;
        if (updates.nit_base !== undefined) {
            if (!updates.nit_base || String(updates.nit_base).trim() === "" || updates.nit_base === "Sin NIT") {
                updatedNitBase = generateProvisionalNit();
            } else {
                updatedNitBase = String(updates.nit_base).trim();
            }
        }
        
        // Ensure email and telefono are preserved even if they are null strings
        const sanitizedUpdates: any = {
            ...sanitized,
            ...(updatedNitBase !== undefined ? { nit_base: updatedNitBase } : {}),
            subclasificacion_id: toNum((updates as any).subclasificacion_id),
            departamento_id: toNum((updates as any).departamento_id),
            ciudad_id: toNum((updates as any).ciudad_id),
            pais_id: toNum((updates as any).pais_id),
            telefono: (updates as any).telefono !== undefined ? (updates as any).telefono : sanitized.telefono,
            email: (updates as any).email !== undefined ? (updates as any).email : (sanitized as any).email
        };

        console.log('[useAccounts] DEBUG - sanitizedUpdates result:', JSON.stringify(sanitizedUpdates));
        
        const fullUpdates = { ...sanitizedUpdates, updated_at: new Date().toISOString() };
        const newOwnerId = sanitizedUpdates.owner_user_id;

        let currentLocal = await db.accounts.get(id);
        if (!currentLocal && typeof window !== 'undefined' && navigator.onLine) {
            console.log(`[useAccounts] Account ${id} not in Dexie. Fetching from Supabase...`);
            const { data: remoteAcc } = await supabase
                .from('CRM_Cuentas')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (remoteAcc) {
                currentLocal = remoteAcc as LocalCuenta;
                await db.accounts.put(remoteAcc);
            }
        }
        if (!currentLocal) {
            currentLocal = { id, owner_user_id: null } as any;
        }

        const ownerChanged = newOwnerId !== undefined && newOwnerId !== null && currentLocal?.owner_user_id !== newOwnerId;
        const oppUpdates: LocalOportunidad[] = [];

        if (typeof window !== 'undefined' && navigator.onLine) {
            try {
                console.log(`[useAccounts] Updating CRM_Cuentas ${id} directly in Supabase:`, fullUpdates);
                await supabase.from('CRM_Cuentas').update(fullUpdates).eq('id', id);

                if (ownerChanged) {
                    console.log(`[useAccounts] Updating all CRM_Oportunidades in Supabase for account_id=${id} to owner=${newOwnerId}`);
                    const { error: supErr } = await supabase
                        .from('CRM_Oportunidades')
                        .update({
                            owner_user_id: newOwnerId,
                            updated_at: fullUpdates.updated_at
                        })
                        .eq('account_id', id)
                        .eq('is_deleted', false);

                    if (supErr) {
                        console.error('[useAccounts] Supabase opportunity owner update error:', supErr);
                    }
                }
            } catch (err) {
                console.error('[useAccounts] Direct Supabase update exception:', err);
            }
        }

        if (ownerChanged) {
            // Gather local opportunities in Dexie for local sync/commit
            const relatedOpps = await db.opportunities.where('account_id').equals(id).toArray();
            for (const opp of relatedOpps) {
                if (opp.owner_user_id !== newOwnerId) {
                    oppUpdates.push({
                        ...opp,
                        owner_user_id: newOwnerId,
                        updated_at: fullUpdates.updated_at
                    });
                }
            }
        }

        await syncEngine.commitLocalChanges([db.accounts, db.opportunities], async () => {
            await db.accounts.update(id, fullUpdates);
            const mergedRecord = { ...currentLocal, ...fullUpdates } as LocalCuenta;

            if (oppUpdates.length > 0) {
                for (const opp of oppUpdates) {
                    await db.opportunities.update(opp.id, {
                        owner_user_id: newOwnerId,
                        updated_at: fullUpdates.updated_at
                    });

                    // Dispatch optimistic update event for active views
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('crm-optimistic-update', {
                            detail: {
                                entityType: 'CRM_Oportunidades',
                                entityId: opp.id,
                                updates: { owner_user_id: newOwnerId }
                            }
                        }));
                    }
                }
            }

            return [
                {
                    entityTable: 'CRM_Cuentas', entityId: id, changes: mergedRecord,
                    options: { isSnapshot: true }
                },
                ...oppUpdates.map(opp => ({
                    entityTable: 'CRM_Oportunidades', entityId: opp.id, changes: sanitizeOpportunityForSync(opp),
                    options: { isSnapshot: true }
                }))
            ];
        });
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

        // 2. Delete local records and queue every server tombstone atomically.
        await syncEngine.commitLocalChanges([
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

            return [
                { entityTable: 'CRM_Cuentas', entityId: id, changes: { ...currentAccount, is_deleted: true }, options: { isSnapshot: true } },
                ...contacts.map(contact => ({ entityTable: 'CRM_Contactos', entityId: contact.id, changes: { ...contact, is_deleted: true }, options: { isSnapshot: true } })),
                ...opportunities.map(opp => ({ entityTable: 'CRM_Oportunidades', entityId: opp.id, changes: { ...opp, is_deleted: true }, options: { isSnapshot: true } })),
                ...quotes.map(quote => ({ entityTable: 'CRM_Cotizaciones', entityId: quote.id, changes: { ...quote, is_deleted: true }, options: { isSnapshot: true } })),
                ...quoteItems.map(item => {
                    const { subtotal, ...itemData } = item;
                    return { entityTable: 'CRM_CotizacionItems', entityId: item.id, changes: { ...itemData, is_deleted: true }, options: { isSnapshot: true } };
                }),
                ...activities.map(act => ({ entityTable: 'CRM_Actividades', entityId: act.id, changes: { ...act, is_deleted: true }, options: { isSnapshot: true } })),
                ...pedidos.map(ped => ({ entityTable: 'CRM_Pedidos', entityId: ped.uuid_generado, changes: { ...ped, is_deleted: true }, options: { isSnapshot: true } })),
                ...pedidoItems.map(pItem => ({ entityTable: 'CRM_PedidoItems', entityId: pItem.id, changes: { ...pItem, is_deleted: true }, options: { isSnapshot: true } }))
            ];
        });

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
