
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
        const { data: { user } } = await syncEngine.getCurrentUser();

        const newContact: LocalContact = {
            id,
            account_id: data.account_id || accountId!,
            nombre: data.nombre,
            cargo: data.cargo,
            email: data.email,
            telefono: data.telefono,
            es_principal: data.es_principal || false,
            comentarios: data.comentarios,
            created_by: user?.id,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };

        await syncEngine.commitLocalChanges([db.contacts], async () => {
            const requests = [];
            if (newContact.es_principal) {
                const previousPrincipals = await db.contacts
                    .where('account_id').equals(newContact.account_id)
                    .filter(contact => contact.es_principal === true)
                    .toArray();
                for (const contact of previousPrincipals) {
                    const updated = { ...contact, es_principal: false, updated_at: new Date().toISOString() };
                    await db.contacts.put(updated);
                    requests.push({ entityTable: 'CRM_Contactos', entityId: contact.id, changes: updated, options: { isSnapshot: true } });
                }
            }
            await db.contacts.add(newContact);
            requests.push({ entityTable: 'CRM_Contactos', entityId: id, changes: newContact, options: { isSnapshot: true } });
            return requests;
        });
        return id;
    };

    const updateContact = async (id: string, updates: Partial<LocalContact>) => {
        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        
        // Use db.contacts.get to check local existence, but if not found, we'll still proceed with a PUT
        await syncEngine.commitLocalChanges([db.contacts], async () => {
            const currentLocal = await db.contacts.get(id);
            const record = currentLocal
                ? { ...currentLocal, ...fullUpdates }
                : { id, ...fullUpdates } as LocalContact;
            const requests = [];

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
                        requests.push({ entityTable: 'CRM_Contactos', entityId: contact.id, changes: updated, options: { isSnapshot: true } });
                    }
                }
            }

            await db.contacts.put(record);
            requests.push({ entityTable: 'CRM_Contactos', entityId: id, changes: record, options: { isSnapshot: true } });
            return requests;
        });
    };

    const deleteContact = async (id: string) => {
        const current = await db.contacts.get(id);
        if (!current) return;
        await syncEngine.commitLocalChanges([db.contacts], async () => {
            await db.contacts.delete(id);
            return [{
                entityTable: 'CRM_Contactos', entityId: id,
                changes: { ...current, is_deleted: true }, options: { isSnapshot: true }
            }];
        });
    };

    return { contacts, createContact, updateContact, deleteContact };
}
