/**
 * Contact visibility logic across CRM roles
 * In Firplak CRM, all roles (ADMIN, COORDINADOR, VENDEDOR) have global search
 * and visibility over CRM_Contactos (view_contacts permission) so advisors can
 * locate client representatives by phone/email/name even if the account belongs
 * to another advisor.
 */

export function shouldRestrictContactsByAccountOwner(role?: string | null): boolean {
    void role;
    // Contacts directory is shared across all sales roles to prevent duplicate contacts
    // and allow advisors to locate customers by phone/name.
    return false;
}

export function filterContactsForUser<T extends { account_id: string }>(
    contacts: T[],
    options: { role?: string | null; userAccountIds?: Set<string> } = {}
): T[] {
    if (shouldRestrictContactsByAccountOwner(options.role) && options.userAccountIds) {
        return contacts.filter(c => options.userAccountIds!.has(c.account_id));
    }
    return contacts;
}
