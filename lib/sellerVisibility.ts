/**
 * Visibilidad en la app para el rol asesor (VENDEDOR).
 *
 * Regla (solo de visualización, no cambia la base de datos):
 * - Oportunidad: el asesor es el dueño (owner_user_id) o colaborador de la oportunidad.
 * - Cuenta: el asesor es el dueño (o, si la cuenta no tiene dueño, quien la creó),
 *   o la cuenta tiene una oportunidad donde el asesor es colaborador.
 * - Contacto: pertenece a una cuenta visible para el asesor.
 * - Actividad: está asignada al asesor (user_id), salvo la excepción de cartera completa.
 * ADMIN y COORDINADOR no cambian.
 */

export const SELLER_ROLE = 'VENDEDOR';

export function isSellerRole(role: string | null | undefined): boolean {
    return role === SELLER_ROLE;
}

/**
 * Identidades que conservan su rol (VENDEDOR) pero ven todas las cuentas,
 * contactos, oportunidades y actividades. No abre borrar, precios,
 * usuarios ni comisiones. La lista vive solo aquí.
 *
 * No hace falta un flag en base de datos: RLS ya permite la lectura y la
 * restricción es de la app. Un campo en CRM_Usuarios solo haría falta si
 * esto debiera cambiarse sin desplegar código; no se aplicó.
 */
export const VIEW_ALL_ACCOUNTS_CONTACTS_OPPORTUNITIES_ALLOWLIST: ReadonlyArray<{
    id: string;
    email: string;
}> = [
    {
        id: '1870c27f-e901-41ed-97d4-7ecc89fd4935',
        email: 'cotizaciones@firplak.co',
    },
];

export type PortfolioIdentity = {
    id?: string | null;
    email?: string | null;
};

function normalizeIdentity(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
}

/** True si este usuario ve todas las cuentas, contactos, oportunidades y actividades. */
export function canViewAllAccountsContactsOpportunities(
    user: PortfolioIdentity | string | null | undefined
): boolean {
    if (user == null) return false;
    const id = normalizeIdentity(typeof user === 'string' ? user : user.id);
    const email = normalizeIdentity(typeof user === 'string' ? null : user.email);
    if (!id && !email) return false;
    return VIEW_ALL_ACCOUNTS_CONTACTS_OPPORTUNITIES_ALLOWLIST.some((entry) => {
        const entryId = normalizeIdentity(entry.id);
        const entryEmail = normalizeIdentity(entry.email);
        return (id !== '' && id === entryId) || (email !== '' && email === entryEmail);
    });
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
 * Determina si una notificación de actividad vencida debe mostrarse al usuario.
 * Para un asesor (VENDEDOR), solo se muestra si la actividad está asignada a él.
 * Las actividades del setter u otros usuarios nunca deben alarmar al asesor.
 */
export function shouldShowActivityNotification(
    notificationType: string,
    activityUserId: string | null | undefined,
    userRole: string | null | undefined,
    currentUserId: string | null | undefined
): boolean {
    if (notificationType !== 'ACTIVITY_OVERDUE') return true;
    if (canViewAllAccountsContactsOpportunities(currentUserId)) return true;
    if (isSellerRole(userRole) && currentUserId) {
        return activityUserId === currentUserId;
    }
    return true;
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
    if (canViewAllAccountsContactsOpportunities(userId)) return list;
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
