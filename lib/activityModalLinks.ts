/** Enlaces del modal. Solo necesitan los ids: la cuenta o la oportunidad pueden no estar en Dexie. */
export function activityEntityHrefs(input: {
    opportunityId?: string | null;
    accountId?: string | null;
}): { accountHref: string | null; opportunityHref: string | null } {
    const accountId = (input.accountId || '').trim();
    const opportunityId = (input.opportunityId || '').trim();
    return {
        accountHref: accountId ? `/cuentas?id=${accountId}` : null,
        opportunityHref: opportunityId ? `/oportunidades/${opportunityId}` : null,
    };
}
