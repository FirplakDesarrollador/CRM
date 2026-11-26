/**
 * Filtro de fases del listado de oportunidades.
 *
 * Las opciones salen del catálogo real (CRM_FasesOportunidad / Dexie), solo fases
 * activas y deduplicadas por canal. "Todas" es la selección vacía: no se filtra.
 * Varias fases se combinan. Los ids históricos del mismo canal y etapa se incluyen
 * con expandSelectedPhaseIds para no perder oportunidades viejas.
 */

import { expandSelectedPhaseIds, selectPhasesForPicker, type PhaseCatalogItem } from './opportunityPhaseCatalog';
import { PROSPECTO_PHASE_ID } from './opportunityColumnFilterHelpers';
import { normalizePhaseName } from './opportunityPhase';

export { PROSPECTO_PHASE_ID };

export interface PhaseFilterOption {
    id: number;
    label: string;
    nombre: string;
    canalId: string | null;
}

export function parsePersistedPhaseIds(raw: string | null | undefined): number[] {
    if (!raw) return [];
    const ids = raw
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((id) => Number.isFinite(id));
    return Array.from(new Set(ids));
}

/** Lee `phases` (varios ids) y, si no viene, el parámetro viejo `phase` (un id). */
export function readPersistedPhaseIds(
    phasesParam: string | null | undefined,
    legacyPhaseParam?: string | null
): number[] {
    const multi = parsePersistedPhaseIds(phasesParam);
    if (multi.length > 0) return multi;
    return parsePersistedPhaseIds(legacyPhaseParam);
}

export function serializePhaseIds(ids: readonly number[] | null | undefined): string | null {
    const normalized = normalizePhaseFilterValue(ids ?? []);
    return normalized.length > 0 ? normalized.join(',') : null;
}

/** Acepta un id, una lista o vacío. Quita repetidos. */
export function normalizePhaseFilterValue(value: number | readonly number[] | null | undefined): number[] {
    if (value == null) return [];
    const list = Array.isArray(value) ? value : [value];
    const ids = list.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    return Array.from(new Set(ids));
}

/** Quita `status` de una query guardada para no reaplicar el filtro de estado. */
export function withoutOpportunityStatusParam(query: string): string {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    params.delete('status');
    const next = params.toString();
    return query.startsWith('?') ? (next ? `?${next}` : '') : next;
}

function channelLabel(canalId: string | null, channelLabels?: ReadonlyMap<string, string> | Record<string, string> | null): string {
    if (!canalId) return 'Sin canal';
    if (!channelLabels) return canalId;
    if (channelLabels instanceof Map) return channelLabels.get(canalId) || canalId;
    const labels = channelLabels as Record<string, string>;
    return labels[canalId] || canalId;
}

/**
 * Fases que se pueden marcar. Con canal, solo ese embudo.
 * Sin canal, cada embudo por separado (el orden no se mezcla entre canales).
 * Si el mismo nombre existe en más de un canal, el rótulo lleva el canal.
 * Prospecto (sin fase) es la opción sintética ya usada por el listado (id -1).
 */
export function buildPhaseFilterOptions(
    phases: readonly PhaseCatalogItem[] | null | undefined,
    channelId?: string | null,
    channelLabels?: ReadonlyMap<string, string> | Record<string, string> | null
): PhaseFilterOption[] {
    const source = phases || [];
    let picked: PhaseCatalogItem[];
    if (channelId) {
        picked = selectPhasesForPicker(source, channelId);
    } else {
        const canals = Array.from(new Set(source.map((phase) => phase.canal_id).filter((id): id is string => Boolean(id))));
        picked = [
            ...canals.flatMap((canal) => selectPhasesForPicker(source, canal)),
            ...selectPhasesForPicker(source.filter((phase) => !phase.canal_id)),
        ];
    }

    const nameCounts = new Map<string, number>();
    for (const phase of picked) {
        const key = normalizePhaseName(phase.nombre);
        nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }

    const options: PhaseFilterOption[] = picked.map((phase) => {
        const nombre = (phase.nombre || '').trim() || `Fase ${phase.id}`;
        const canalId = phase.canal_id ?? null;
        const sharedName = (nameCounts.get(normalizePhaseName(phase.nombre)) || 0) > 1;
        const label = sharedName ? `${nombre} (${channelLabel(canalId, channelLabels)})` : nombre;
        return { id: Number(phase.id), label, nombre, canalId };
    });

    return [
        { id: PROSPECTO_PHASE_ID, label: 'Prospecto (Sin fase)', nombre: 'Prospecto (Sin fase)', canalId: null },
        ...options,
    ];
}

export interface PhaseIdQuery {
    includeUnassigned: boolean;
    faseIds: number[];
}

/** Ids de fase que debe usar la consulta, más el caso "sin fase". */
export function resolvePhaseIdQuery(
    selectedIds: readonly number[] | null | undefined,
    catalog: readonly PhaseCatalogItem[] | null | undefined
): PhaseIdQuery {
    const ids = normalizePhaseFilterValue(selectedIds ?? []);
    const includeUnassigned = ids.includes(PROSPECTO_PHASE_ID);
    const faseIds = expandSelectedPhaseIds(ids.filter((id) => id > 0), catalog);
    return { includeUnassigned, faseIds };
}

export function opportunityMatchesPhaseIds(
    faseId: number | string | null | undefined,
    selectedIds: readonly number[] | null | undefined,
    catalog: readonly PhaseCatalogItem[] | null | undefined
): boolean {
    const ids = normalizePhaseFilterValue(selectedIds ?? []);
    if (ids.length === 0) return true;
    const { includeUnassigned, faseIds } = resolvePhaseIdQuery(ids, catalog);
    const empty = faseId === null || faseId === undefined || faseId === '';
    if (empty) return includeUnassigned;
    return faseIds.includes(Number(faseId));
}
