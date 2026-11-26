/** Enlaces del modal. Solo necesitan los ids: la cuenta, la oportunidad o el contacto pueden no estar en Dexie. */
export function activityEntityHrefs(input: {
    opportunityId?: string | null;
    accountId?: string | null;
    contactId?: string | null;
}): { accountHref: string | null; opportunityHref: string | null; contactHref: string | null } {
    const accountId = (input.accountId || '').trim();
    const opportunityId = (input.opportunityId || '').trim();
    const contactId = (input.contactId || '').trim();
    return {
        accountHref: accountId ? `/cuentas?id=${accountId}` : null,
        opportunityHref: opportunityId ? `/oportunidades/${opportunityId}` : null,
        // Misma ruta que getEntityUrl('contacto', id) y el resto de la app.
        contactHref: contactId ? `/contactos?id=${contactId}` : null,
    };
}

export type ActivityContactCandidate = {
    id?: string | null;
    es_principal?: boolean | null;
    is_deleted?: boolean | null;
};

function cleanId(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    return id || null;
}

/** La actividad puede traer contact_id o el nombre legado contacto_id. */
export function activityContactIdFrom(activity?: {
    contact_id?: string | null;
    contacto_id?: string | null;
} | null): string | null {
    return cleanId(activity?.contact_id) || cleanId(activity?.contacto_id);
}

/**
 * Contacto al que debe ir "Ir al contacto":
 * 1. el de la actividad, si tiene uno y no está borrado;
 * 2. si no, el de la oportunidad (el principal entre sus contactos, o el primero);
 * 3. si no, el contacto principal de la cuenta.
 * Sin ninguno, no hay enlace.
 */
export function resolveActivityContactId(input: {
    activityContactId?: string | null;
    opportunityContactIds?: Array<string | null> | null;
    accountContacts?: ActivityContactCandidate[] | null;
}): string | null {
    const contacts = (input.accountContacts || []).filter(contact => cleanId(contact.id));
    const deleted = new Set(
        contacts.filter(contact => contact.is_deleted).map(contact => cleanId(contact.id) as string)
    );
    const usable = (id: string | null) => (id && !deleted.has(id) ? id : null);

    const activityId = usable(cleanId(input.activityContactId));
    if (activityId) return activityId;

    const opportunityIds = (Array.isArray(input.opportunityContactIds) ? input.opportunityContactIds : [])
        .map(cleanId)
        .filter((id): id is string => !!id && !deleted.has(id));

    if (opportunityIds.length > 0) {
        const principal = opportunityIds.find(id =>
            contacts.some(contact => cleanId(contact.id) === id && contact.es_principal && !contact.is_deleted)
        );
        return principal || opportunityIds[0];
    }

    const accountPrincipal = contacts.find(contact => contact.es_principal && !contact.is_deleted);
    return cleanId(accountPrincipal?.id);
}
