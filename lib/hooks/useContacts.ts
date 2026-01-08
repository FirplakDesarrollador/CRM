
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
        await syncEngine.queueMutation('CRM_Contactos', id, newContact);
        return id;
    };

    const updateContact = async (id: string, updates: Partial<LocalContact>) => {
        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        const currentContact = await db.contacts.get(id);

        if (!currentContact) {
            console.error("Contact not found for update:", id);
            return;
        }

        // Handle principal switch
        if (fullUpdates.es_principal) {
            await db.contacts
                .where('account_id').equals(currentContact.account_id)
                .modify({ es_principal: false });
        }

        await db.contacts.update(id, fullUpdates);

        // Prepare sync payload with required fields for UPSERT safety
        // The RPC likely attempts an insert if it can't find the row (or purely for validation),
        // so we must provide NOT NULL fields like account_id.
        const syncPayload = { ...fullUpdates };
        if (!syncPayload.account_id) syncPayload.account_id = currentContact.account_id;
        if (!syncPayload.created_by && currentContact.created_by) syncPayload.created_by = currentContact.created_by;

        await syncEngine.queueMutation('CRM_Contactos', id, syncPayload);
    };

    const deleteContact = async (id: string) => {
        await db.contacts.delete(id);
        await syncEngine.queueMutation('CRM_Contactos', id, { is_deleted: true });
    };

    return { contacts, createContact, updateContact, deleteContact };
}
