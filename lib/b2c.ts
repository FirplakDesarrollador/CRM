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
