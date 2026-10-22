/**
 * Helpers y definiciones para los menús de filtrado de cabeceras en la tabla de Oportunidades.
 * Permiten que las opciones se consulten desde catálogos maestros de la BD sin cargar todas las filas en memoria.
 */

export interface OpportunityFilterState {
    channel?: string | null;
    phase?: number | null;
    ownerIds?: string[] | null;
    status?: 'all' | 'open' | 'won' | 'lost' | null;
    origin?: string | null;
    country?: number | null;
    city?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    startClose?: string | null;
    endClose?: string | null;
    accountId?: string | null;
    accountName?: string | null;
}

export interface ChannelOption {
    id: string;
    label: string;
    badgeClass: string;
}

export const SALES_CHANNEL_OPTIONS: ChannelOption[] = [
    { id: 'PROPIO', label: 'Propio', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'OBRAS_NAC', label: 'Obras Nal', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'OBRAS_INT', label: 'Obras Int', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    { id: 'DIST_NAC', label: 'Dist Nal', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'DIST_INT', label: 'Dist Int', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
];

export const OPPORTUNITY_STATUS_OPTIONS = [
    { id: 'all', label: 'Todas las oportunidades', description: 'Incluye abiertas, ganadas y perdidas', icon: '🌐' },
    { id: 'open', label: 'Abiertas / En proceso', description: 'Oportunidades activas en el embudo', icon: '🟢' },
    { id: 'won', label: 'Ganadas', description: 'Cerradas con éxito', icon: '🏆' },
    { id: 'lost', label: 'Perdidas', description: 'Descartadas o no concretadas', icon: '❌' }
];

export const PROSPECTO_PHASE_ID = -1;

export interface PhaseCatalogItem {
    id: number;
    nombre: string;
    canal_id?: string | null;
    orden?: number;
}

/**
 * Filtra las fases según el canal seleccionado, excluyendo fases de cierre ('cerrada'),
 * y deduplicando por nombre para que cada etapa única del embudo aparezca una sola vez.
 */
export function getAvailablePhasesForChannel(
    phases: PhaseCatalogItem[],
    selectedChannel: string | null
): PhaseCatalogItem[] {
    if (!selectedChannel) return [];

    // 1. Filtrar por canal y descartar estados cerrados (manejados por filtro ESTADO)
    const channelPhases = phases.filter(p =>
        p.canal_id === selectedChannel &&
        !p.nombre.toLowerCase().includes('cerrada')
    );

    // 2. Ordenar por 'orden' si existe
    channelPhases.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    // 3. Deduplicar por nombre (si hay múltiples IDs para el mismo nombre en el mismo canal)
    const seenNames = new Set<string>();
    const deduplicated: PhaseCatalogItem[] = [];

    for (const ph of channelPhases) {
        const cleanName = ph.nombre.trim().toLowerCase();
        if (!seenNames.has(cleanName)) {
            seenNames.add(cleanName);
            deduplicated.push(ph);
        }
    }

    return deduplicated;
}

/**
 * Obtiene todos los IDs equivalentes (duplicados de BD) para una fase dada dentro de su canal
 */
export function getEquivalentPhaseIds(
    phases: PhaseCatalogItem[],
    targetPhaseId: number
): number[] {
    if (targetPhaseId <= 0) return [targetPhaseId];
    const target = phases.find(p => p.id === targetPhaseId);
    if (!target) return [targetPhaseId];

    const targetName = target.nombre?.trim().toLowerCase();
    const targetChannel = target.canal_id;

    const matches = phases.filter(p =>
        p.nombre?.trim().toLowerCase() === targetName &&
        (!targetChannel || p.canal_id === targetChannel)
    );

    return matches.length > 0 ? matches.map(p => p.id) : [targetPhaseId];
}

export const ACTIVITY_STATUS_OPTIONS = [
    { id: 'all', label: 'Todas las actividades', icon: '📋' },
    { id: 'overdue', label: 'Atrasada', icon: '🔴', desc: 'Con tareas vencidas pendientes' },
    { id: 'scheduled', label: 'Programada', icon: '🔵', desc: 'Con tareas programadas a futuro' },
    { id: 'completed', label: 'Completada', icon: '🟢', desc: 'Todas las tareas realizadas' },
    { id: 'none', label: 'Sin actividad', icon: '⚪', desc: 'Sin ninguna tarea registrada' }
];

/**
 * Determina si una columna de la tabla tiene un filtro activo aplicado
 */
export function isColumnFilterActive(colKey: string, state: OpportunityFilterState): boolean {
    if (!state) return false;
    switch (colKey) {
        case 'canal':
            return Boolean(state.channel);
        case 'fase':
            return Boolean(state.phase);
        case 'vendedor':
            return Boolean(state.ownerIds && state.ownerIds.length > 0);
        case 'estado':
            return Boolean(state.status && state.status !== 'open');
        case 'origen':
            return Boolean(state.origin);
        case 'pais':
            return Boolean(state.country);
        case 'ciudad':
            return Boolean(state.city && state.city.trim() !== '');
        case 'cuenta':
            return Boolean(state.accountId || (state.accountName && state.accountName.trim() !== ''));
        case 'creada':
            return Boolean(state.startDate || state.endDate);
        case 'cierre':
            return Boolean(state.startClose || state.endClose);
        default:
            return false;
    }
}

/**
 * Formatea el título del encabezado de la tabla con el indicador de ordenamiento y el badge azul si está filtrado
 */
export function formatColumnHeaderTitle(title: string, sortIndicator: string, isFiltered: boolean): string {
    const parts = [title];
    if (sortIndicator && sortIndicator.trim()) {
        parts.push(sortIndicator.trim());
    }
    if (isFiltered) {
        parts.push('🔵');
    }
    return parts.join(' ');
}
