
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalContact } from "@/lib/db";
import { executeDirectMutations, fetchRecordDirect, DirectMutationRequest } from "@/lib/supabaseDirect";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { registrarEliminacionFallida } from "@/lib/eliminaciones";

export function useContacts(accountId?: string) {
    const { user, isAdmin, isCoordinador } = useCurrentUser();
    const userId = user?.id;

    // Direct Supabase fetch for contacts of this account
    useEffect(() => {
        if (!accountId || typeof window === 'undefined' || !navigator.onLine) return;
        if (process.env.NODE_ENV !== 'production' && window.location?.pathname?.startsWith('/e2e/')) return;

        let cancelled = false;
        const loadContacts = async () => {
            try {
                const { data, error } = await supabase
                    .from('CRM_Contactos')
                    .select('*')
                    .eq('account_id', accountId)
                    .eq('is_deleted', false);
                if (!cancelled && !error && Array.isArray(data) && data.length > 0) {
                    await db.contacts.bulkPut(data as LocalContact[]);
                }
            } catch (err) {
                console.warn('[useContacts] Direct Supabase load warning:', err);
            }
        };
        void loadContacts();
        return () => {
            cancelled = true;
        };
    }, [accountId]);

    const contacts = useLiveQuery(
        () => accountId
            ? db.contacts.where('account_id').equals(accountId).toArray()
            : db.contacts.toArray(),
        [accountId]
    );

    const createContact = async (data: Omit<LocalContact, 'id' | 'account_id'> & { account_id?: string }) => {
        if (!data.account_id && !accountId) throw new Error("Account ID is required for contacts");

        const targetAccountId = data.account_id || accountId!;

        // Local duplicate check before inserting (phone)
        if (data.telefono && data.telefono.trim() !== '') {
            const existingLocal = await db.contacts
                .where('account_id')
                .equals(targetAccountId)
                .toArray();
            
            const hasDuplicate = existingLocal.some(c => c.telefono === data.telefono && !c.is_deleted);
            if (hasDuplicate) {
                throw new Error(`Ya existe un contacto con el teléfono ${data.telefono} en esta cuenta.`);
            }
        }

        const id = uuidv4();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        const newContact: LocalContact = {
            id,
            account_id: data.account_id || accountId!,
            nombre: data.nombre,
            cargo: data.cargo,
            email: data.email,
            telefono: data.telefono,
            es_principal: data.es_principal || false,
            comentarios: data.comentarios,
            created_by: authUser?.id,
            updated_by: authUser?.id,
            updated_at: new Date().toISOString()
        };

        await executeDirectMutations(async () => {
            const requests: DirectMutationRequest[] = [];
            if (newContact.es_principal) {
                const previousPrincipals = await db.contacts
                    .where('account_id').equals(newContact.account_id)
                    .filter(contact => contact.es_principal === true)
                    .toArray();
                for (const contact of previousPrincipals) {
                    const updated = { ...contact, es_principal: false, updated_at: new Date().toISOString() };
                    await db.contacts.put(updated);
                    requests.push({ entityTable: 'CRM_Contactos', entityId: contact.id, changes: updated as unknown as Record<string, unknown> });
                }
            }
            await db.contacts.put(newContact);
            requests.push({ entityTable: 'CRM_Contactos', entityId: id, changes: newContact as unknown as Record<string, unknown> });
            return requests;
        });
        return id;
    };

    const updateContact = async (id: string, updates: Partial<LocalContact>) => {
        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        const currentLocal = (await db.contacts.get(id)) || (await fetchRecordDirect<LocalContact>('CRM_Contactos', id));

        await executeDirectMutations(async () => {
            const record = currentLocal
                ? { ...currentLocal, ...fullUpdates }
                : { id, ...fullUpdates } as LocalContact;
            const requests: DirectMutationRequest[] = [];

            if (fullUpdates.es_principal) {
                const targetAccountId = fullUpdates.account_id || currentLocal?.account_id || accountId;
                if (targetAccountId) {
                    const previousPrincipals = await db.contacts
                        .where('account_id').equals(targetAccountId)
                        .filter(contact => contact.id !== id && contact.es_principal === true)
                        .toArray();
                    for (const contact of previousPrincipals) {
                        const updated = { ...contact, es_principal: false, updated_at: new Date().toISOString() };
                        await db.contacts.put(updated);
                        requests.push({ entityTable: 'CRM_Contactos', entityId: contact.id, changes: updated as unknown as Record<string, unknown> });
                    }
                }
            }

            await db.contacts.put(record);
            requests.push({ entityTable: 'CRM_Contactos', entityId: id, changes: record as unknown as Record<string, unknown> });
            return requests;
        });
    };

    const deleteContact = async (id: string) => {
        const current = (await db.contacts.get(id)) || (await fetchRecordDirect<LocalContact>('CRM_Contactos', id));
        if (!current) return;
        try {
            let isOwner = !!userId && (current as { owner_user_id?: string; created_by?: string }).created_by === userId;
            if (!isOwner && userId && current.account_id) {
                const acc = (await db.accounts.get(current.account_id)) || (await fetchRecordDirect<Record<string, unknown>>('CRM_Cuentas', current.account_id));
                isOwner = !!acc && ((acc as { owner_user_id?: string; created_by?: string }).owner_user_id === userId || (acc as { owner_user_id?: string; created_by?: string }).created_by === userId);
            }
            if (!isAdmin && !isCoordinador && !isOwner) {
                throw new Error("No tienes permiso para eliminar este contacto");
            }
            await executeDirectMutations(async () => {
                await db.contacts.delete(id);
                return [{
                    entityTable: 'CRM_Contactos',
                    entityId: id,
                    changes: { ...current, is_deleted: true, updated_at: new Date().toISOString() } as unknown as Record<string, unknown>,
                }];
            });
        } catch (err) {
            await registrarEliminacionFallida('CRM_Contactos', id, err);
            throw err;
        }
    };

    return { contacts, createContact, updateContact, deleteContact };
}
