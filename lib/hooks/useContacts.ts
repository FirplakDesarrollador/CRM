
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalContact } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { v4 as uuidv4 } from 'uuid';

export function useContacts(accountId?: string) {
    const contacts = useLiveQuery(
        () => accountId
            ? db.contacts.where('account_id').equals(accountId).toArray()
            : db.contacts.toArray(),
        [accountId]
    );

    const createContact = async (data: Omit<LocalContact, 'id' | 'account_id'> & { account_id?: string }) => {
        if (!data.account_id && !accountId) throw new Error("Account ID is required for contacts");

        const id = uuidv4();
        const { data: { user } } = await syncEngine.getCurrentUser();

        const newContact: LocalContact = {
            id,
            account_id: data.account_id || accountId!,
            nombre: data.nombre,
            cargo: data.cargo,
            email: data.email,
            telefono: data.telefono,
            es_principal: data.es_principal || false,
            created_by: user?.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };

        // If principal, unset others for this account locally first (optional logic)
        if (newContact.es_principal) {
            await db.contacts
                .where('account_id').equals(newContact.account_id)
                .modify({ es_principal: false });
        }

        await db.contacts.add(newContact);
        await syncEngine.queueMutation('CRM_Contactos', id, newContact, { isSnapshot: true });
        return id;
    };

    const updateContact = async (id: string, updates: Partial<LocalContact>) => {
        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        
        // Use db.contacts.get to check local existence, but if not found, we'll still proceed with a PUT
        const currentLocal = await db.contacts.get(id);

        if (fullUpdates.es_principal) {
            // Priority: use provided account_id, fallback to current local, then to initial hook accountId
            const targetAccountId = fullUpdates.account_id || currentLocal?.account_id || accountId;
            if (targetAccountId) {
                await db.contacts
                    .where('account_id').equals(targetAccountId)
                    .modify({ es_principal: false });
            }
        }

        // --- THE FIX ---
        // Instead of .update (which fails if ID doesn't exist), use .put for Upsert-safety.
        // We merge with current local state if it exists, otherwise we rely on updates + required fields.
        if (currentLocal) {
            const merged = { ...currentLocal, ...fullUpdates };
            await db.contacts.put(merged);
            // ATENCIÓN: Usamos isSnapshot: true para asegurar que si el contacto no existe en el servidor
            // (por ejemplo, si falló la creación inicial), se inserte con todos los campos obligatorios.
            await syncEngine.queueMutation('CRM_Contactos', id, merged, { isSnapshot: true });
        } else {
            const newRecord = { id, ...fullUpdates } as LocalContact;
            await db.contacts.put(newRecord);
            await syncEngine.queueMutation('CRM_Contactos', id, newRecord, { isSnapshot: true });
        }
    };

    const deleteContact = async (id: string) => {
        await db.contacts.delete(id);
        await syncEngine.queueMutation('CRM_Contactos', id, { is_deleted: true });
    };

    return { contacts, createContact, updateContact, deleteContact };
}
