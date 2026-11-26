/**
 * Visibilidad de los usuarios de tienda.
 *
 * La bandera vive en CRM_Usuarios.es_tienda. El rol (COORDINADOR, VENDEDOR, ADMIN)
 * no cambia. Sin la columna, o con es_tienda distinto de true, nadie entra en esta regla.
 *
 * - Cuentas: sin recorte.
 * - Oportunidades: solo las que posee (owner_user_id). No alcanza con crearlas ni con colaborar.
 * - Actividades: solo las asignadas (user_id). No alcanza con haberlas creado.
 */

export const TIENDA_COLUMN = 'es_tienda';

export const CRM_USUARIO_SELECT_BASE = 'id, email, full_name, role, is_active, coordinadores, allowed_modules, canales';
export const CRM_USUARIO_SELECT_WITH_TIENDA = `${CRM_USUARIO_SELECT_BASE}, ${TIENDA_COLUMN}`;

export type TiendaProfile = {
    id?: string | null;
    es_tienda?: boolean | null;
};

export function isTiendaUser(user: TiendaProfile | null | undefined): boolean {
    return user?.es_tienda === true;
}

/** El selector de otro usuario en Oportunidades y Actividades queda cerrado. */
export function canChooseOtherPortfolioUsers(user: TiendaProfile | null | undefined): boolean {
    return !isTiendaUser(user);
}

export function isMissingTiendaColumnError(
    error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
    if (!error) return false;
    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();
    const mentionsColumn = message.includes(TIENDA_COLUMN);
    if (code === '42703' || code === 'PGRST204') return mentionsColumn || code === '42703';
    return mentionsColumn && (
        message.includes('does not exist')
        || message.includes('no existe')
        || message.includes('schema cache')
        || message.includes('could not find')
    );
}

type FlagResult = {
    data: { es_tienda?: boolean | null } | null;
    error: { code?: string; message?: string } | null;
};

/**
 * Lee la bandera. Si la migración todavía no está aplicada, devuelve false
 * para conservar la visibilidad actual. Cualquier otro error se propaga.
 */
export async function readEsTiendaFlag(load: () => Promise<FlagResult>): Promise<boolean> {
    const { data, error } = await load();
    if (error) {
        if (isMissingTiendaColumnError(error)) return false;
        throw new Error(error.message || 'No se pudo leer es_tienda');
    }
    return data?.es_tienda === true;
}

export function restrictPortfolioToTienda<T extends { owner_user_id?: string | null }>(
    rows: readonly T[],
    user: TiendaProfile | null | undefined
): T[] {
    if (!isTiendaUser(user) || !user?.id) return rows.slice();
    const userId = user.id;
    return rows.filter(row => row.owner_user_id === userId);
}

export function restrictActivitiesToTienda<T extends { user_id?: string | null }>(
    rows: readonly T[],
    user: TiendaProfile | null | undefined
): T[] {
    if (!isTiendaUser(user) || !user?.id) return rows.slice();
    const userId = user.id;
    return rows.filter(row => row.user_id === userId);
}

export function localIdsOutsideTiendaScope(
    rows: ReadonlyArray<{ id: string; owner_user_id?: string | null; user_id?: string | null }>,
    field: 'owner_user_id' | 'user_id',
    userId: string,
    pendingIds: ReadonlySet<string>
): string[] {
    return rows
        .filter(row => row[field] !== userId && !pendingIds.has(row.id))
        .map(row => row.id);
}

export function filterSearchResultsForTienda<T extends { entity_type: string; id: string }>(
    results: readonly T[],
    user: TiendaProfile | null | undefined,
    ownedOpportunityIds: ReadonlySet<string>
): T[] {
    if (!isTiendaUser(user)) return results.slice();
    return results.filter(result => result.entity_type !== 'opportunity' || ownedOpportunityIds.has(result.id));
}
