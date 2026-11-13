/**
 * B2C (Canal Propio) helpers.
 *
 * In this CRM the B2C business line is the sales channel `PROPIO`
 * (`CRM_Canales.id = 'PROPIO'`, "Canal Propio (B2C)"). Users are tied to it
 * through `CRM_Usuarios.canales`, and accounts through `CRM_Cuentas.canal_id`.
 *
 * Items requested for B2C only (planner task "Funcionalidades CRM B2C") should
 * use these helpers so that they stay out of the way of the other channels.
 */

export const B2C_CHANNEL_ID = 'PROPIO';

/**
 * Activity classifications that only make sense for the B2C team.
 * They live in the shared catalog `CRM_Activity_Clasificacion`, so the UI hides
 * them for users that are neither B2C advisors nor ADMIN.
 */
export const B2C_ONLY_ACTIVITY_CLASSIFICATIONS = ['SETTER', 'Cliente frecuente'] as const;

type UserLike = { role?: string | null; canales?: string[] | null } | null | undefined;

/** True if the user belongs to the B2C channel (or is an ADMIN who sees every channel). */
export function userHasB2CAccess(user: UserLike): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return Array.isArray(user.canales) && user.canales.includes(B2C_CHANNEL_ID);
}

export function isB2COnlyActivityClassification(name: string | null | undefined): boolean {
    if (!name) return false;
    const normalized = name.trim().toLowerCase();
    return B2C_ONLY_ACTIVITY_CLASSIFICATIONS.some(n => n.toLowerCase() === normalized);
}

/**
 * Retorna true si la oportunidad o cuenta pertenece al Canal Propio / B2C / Ecommerce,
 * o si el asesor activo pertenece al canal B2C.
 */
export function isB2COpportunity(
    account?: { canal_id?: string | null } | null,
    opportunity?: { canal_id?: string | null; origen_oportunidad?: string | null } | null,
    user?: UserLike,
    phase?: { canal_id?: string | null } | null
): boolean {
    // 1. Direct match on channel
    if (account?.canal_id === B2C_CHANNEL_ID) return true;
    if (opportunity?.canal_id === B2C_CHANNEL_ID) return true;
    if (phase?.canal_id === B2C_CHANNEL_ID) return true;

    // 2. Origen match (Web, Ecommerce, etc.)
    const origen = (opportunity?.origen_oportunidad || '').toLowerCase();
    if (origen.includes('web') || origen.includes('ecommerce') || origen.includes('e-commerce') || origen.includes('tienda') || origen.includes('feria')) {
        return true;
    }

    // 3. User is explicitly a B2C advisor (has PROPIO in their assigned channels)
    if (Array.isArray(user?.canales) && user.canales.includes(B2C_CHANNEL_ID)) {
        // If the account explicitly belongs to another non-B2C channel (e.g. OBRAS_NAC), respect the account channel
        if (account?.canal_id && account.canal_id !== B2C_CHANNEL_ID) {
            return false;
        }
        return true;
    }

    return false;
}
