/**
 * Visibilidad en la app para el rol asesor (VENDEDOR).
 *
 * Regla (solo de visualización, no cambia la base de datos):
 * - Oportunidad: el asesor es el dueño (owner_user_id) o colaborador de la oportunidad.
 * - Cuenta: el asesor es el dueño (o, si la cuenta no tiene dueño, quien la creó),
 *   o la cuenta tiene una oportunidad donde el asesor es colaborador.
 * - Contacto: pertenece a una cuenta visible para el asesor.
 * - Actividad: está asignada al asesor (user_id).
 * ADMIN y COORDINADOR no cambian.
 */

export const SELLER_ROLE = 'VENDEDOR';

export function isSellerRole(role: string | null | undefined): boolean {
    return role === SELLER_ROLE;
}

type OwnedOpportunity = { id: string; owner_user_id?: string | null };
type OwnedAccount = { id: string; owner_user_id?: string | null; created_by?: string | null };
type AssignedActivity = { user_id?: string | null };

export function sellerCanSeeOpportunity(
    opp: OwnedOpportunity,
    userId: string,
    collabOppIds: ReadonlySet<string>
): boolean {
    return opp.owner_user_id === userId || collabOppIds.has(opp.id);
}

export function sellerCanSeeAccount(
    account: OwnedAccount,
    userId: string,
    collabAccountIds: ReadonlySet<string>
): boolean {
    if (account.owner_user_id === userId) return true;
    if (!account.owner_user_id && account.created_by === userId) return true;
    return collabAccountIds.has(account.id);
}

export function sellerCanSeeActivity(activity: AssignedActivity, userId: string): boolean {
    return activity.user_id === userId;
}

/**
 * Para un asesor, deja solo las actividades asignadas a él (para contadores como
 * "1 programada" / "1 atrasada"). Para otros roles devuelve la lista tal cual.
 */
export function activitiesVisibleToViewer<T extends AssignedActivity>(
    activities: T[] | null | undefined,
    role: string | null | undefined,
    userId: string | null | undefined
): T[] {
    const list = Array.isArray(activities) ? activities : [];
    if (!isSellerRole(role) || !userId) return list;
    return list.filter(a => sellerCanSeeActivity(a, userId));
}

/** Condición PostgREST (para .or()) de oportunidades visibles para un asesor. */
export function sellerOpportunityOrFilter(userId: string, collabOppIds: Iterable<string>): string {
    const ids = Array.from(new Set(collabOppIds)).filter(Boolean);
    const conditions = [`owner_user_id.eq.${userId}`];
    if (ids.length > 0) conditions.push(`id.in.(${ids.join(',')})`);
    return conditions.join(',');
}

/** Condición PostgREST (para .or()) de cuentas visibles para un asesor. */
export function sellerAccountOrFilter(userId: string, collabAccountIds: Iterable<string>): string {
    const ids = Array.from(new Set(collabAccountIds)).filter(Boolean);
    const conditions = [`owner_user_id.eq.${userId}`, `and(owner_user_id.is.null,created_by.eq.${userId})`];
    if (ids.length > 0) conditions.push(`id.in.(${ids.join(',')})`);
    return conditions.join(',');
}
