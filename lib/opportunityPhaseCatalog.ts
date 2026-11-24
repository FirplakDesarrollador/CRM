import { getPhaseOutcomeByName, normalizePhaseName, type PhaseOutcome } from './opportunityPhase';

/**
 * Catálogo de fases de oportunidad.
 *
 * Los selectores (stepper, alta, edición, kanban/filtros) solo ofrecen fases activas
 * y, si hay varias con el mismo orden, se quedan con la activa de menor id.
 * Las inactivas siguen en el catálogo de etiquetas para que una oportunidad histórica
 * muestre su nombre y el stepper marque la fase activa del mismo canal y orden.
 */

export interface PhaseCatalogItem {
    id: number | string;
    nombre?: string | null;
    orden?: number | string | null;
    canal_id?: string | null;
    is_active?: boolean | null;
    probability?: number | null;
}

export function isSelectablePhase(phase: { is_active?: boolean | null } | null | undefined): boolean {
    return phase?.is_active !== false;
}

export function numericOrden(phase: { orden?: number | string | null } | null | undefined): number | null {
    if (!phase || phase.orden === null || phase.orden === undefined || phase.orden === '') return null;
    const value = Number(phase.orden);
    return Number.isFinite(value) ? value : null;
}

/** Une catálogos por id. Las listas posteriores pisan los campos que traen. */
export function mergePhaseCatalog<T extends PhaseCatalogItem>(...lists: readonly (readonly T[] | null | undefined)[]): T[] {
    const byId = new Map<number, T>();
    for (const list of lists) {
        for (const phase of list || []) {
            const id = Number(phase?.id);
            if (!Number.isFinite(id)) continue;
            const previous = byId.get(id);
            byId.set(id, previous ? { ...previous, ...phase, id } : { ...phase, id });
        }
    }
    return Array.from(byId.values());
}

/**
 * Fases que se pueden elegir. Primero quita las inactivas y después deduplica por orden.
 * Sin orden numérico no se colapsan entre sí (un catálogo viejo sin `orden` sigue completo).
 */
export function selectPhasesForPicker<T extends PhaseCatalogItem>(
    phases: readonly T[] | null | undefined,
    canalId?: string | null,
): T[] {
    const source = phases || [];
    const scoped = canalId ? source.filter(phase => phase.canal_id === canalId) : [...source];
    const active = scoped.filter(isSelectablePhase);
    const ranked = [...active].sort((a, b) => {
        const ordenA = numericOrden(a);
        const ordenB = numericOrden(b);
        if (ordenA === null && ordenB === null) return Number(a.id) - Number(b.id);
        if (ordenA === null) return 1;
        if (ordenB === null) return -1;
        if (ordenA !== ordenB) return ordenA - ordenB;
        return Number(a.id) - Number(b.id);
    });

    const seen = new Set<number>();
    const picked: T[] = [];
    for (const phase of ranked) {
        const orden = numericOrden(phase);
        if (orden !== null) {
            if (seen.has(orden)) continue;
            seen.add(orden);
        }
        picked.push(phase);
    }
    return picked;
}

/**
 * Id que debe verse marcado en el stepper.
 * Si `faseId` es una fase inactiva, devuelve la activa del mismo canal y orden.
 */
export function resolveStepperPhaseId(
    faseId: number | string | null | undefined,
    phases: readonly PhaseCatalogItem[] | null | undefined,
    canalId?: string | null,
): number | null {
    if (faseId === null || faseId === undefined || faseId === '') return null;
    const id = Number(faseId);
    if (!Number.isFinite(id)) return null;
    const catalog = phases || [];
    const current = catalog.find(phase => Number(phase.id) === id);
    const canal = canalId ?? current?.canal_id ?? null;
    if (!canal) return isSelectablePhase(current) ? id : null;

    const selectable = selectPhasesForPicker(catalog, canal);
    if (selectable.some(phase => Number(phase.id) === id)) return id;

    const orden = numericOrden(current);
    if (orden === null) return null;
    const match = selectable.find(phase => numericOrden(phase) === orden);
    return match ? Number(match.id) : null;
}

/**
 * Fase activa de un resultado cerrado (ganada o perdida) en el canal.
 * Solo entran fases activas (`selectPhasesForPicker`). Si hay varias, gana el nombre
 * exacto ("Cerrada ganada" / "Cerrada perdida") y, entre esas, la de menor orden.
 */
export function resolveActiveOutcomePhase<T extends PhaseCatalogItem>(
    phases: readonly T[] | null | undefined,
    canalId: string | null | undefined,
    outcome: Extract<PhaseOutcome, 'won' | 'lost'>,
): T | null {
    if (!canalId) return null;
    const exactName = outcome === 'lost' ? 'cerrada perdida' : 'cerrada ganada';
    const matches = selectPhasesForPicker(phases, canalId)
        .filter(phase => getPhaseOutcomeByName(phase.nombre) === outcome);
    if (matches.length === 0) return null;
    const exact = matches.filter(phase => normalizePhaseName(phase.nombre) === exactName);
    return (exact.length > 0 ? exact : matches)[0];
}

/** Fase activa "Cerrada perdida" del canal. En PROPIO es la 122, no la inactiva 88. */
export function resolveActiveLostPhase<T extends PhaseCatalogItem>(
    phases: readonly T[] | null | undefined,
    canalId?: string | null,
): T | null {
    return resolveActiveOutcomePhase(phases, canalId, 'lost');
}

/**
 * Fase que deben pintar el badge y el stepper.
 * Una fase abierta sigue el id activo del mismo orden. Una fase cerrada cuyo equivalente
 * por orden ya no tiene el mismo resultado usa la fase activa de ese resultado (nombre y orden),
 * para que el badge no diga "Cerrada Perdida" mientras el stepper marca otra etapa.
 */
export function resolveShownPhaseId(
    faseId: number | string | null | undefined,
    phases: readonly PhaseCatalogItem[] | null | undefined,
    canalId?: string | null,
    faseText?: string | null,
): number | null {
    const catalog = phases || [];
    const storedLabel = phaseLabelForId(faseId, catalog, '');
    const hintedOutcome = getPhaseOutcomeByName(storedLabel || faseText || '');
    const stored = catalog.find(phase => Number(phase.id) === Number(faseId));
    const canal = canalId || stored?.canal_id || null;
    const byOrder = resolveStepperPhaseId(faseId, catalog, canal);
    if (hintedOutcome === 'open') return byOrder;

    const resolvedOutcome = getPhaseOutcomeByName(
        byOrder == null ? '' : phaseLabelForId(byOrder, catalog, ''),
    );
    if (resolvedOutcome === hintedOutcome) return byOrder;

    const active = resolveActiveOutcomePhase(catalog, canal, hintedOutcome);
    return active ? Number(active.id) : byOrder;
}

/** Nombre para badges y listas. Usa el catálogo completo, incluidas las fases inactivas. */
export function phaseLabelForId(
    faseId: number | string | null | undefined,
    phases: readonly PhaseCatalogItem[] | null | undefined,
    fallback = 'Prospecto',
): string {
    if (faseId === null || faseId === undefined || faseId === '') return fallback;
    const phase = (phases || []).find(item => Number(item.id) === Number(faseId));
    const nombre = phase?.nombre?.trim();
    return nombre || fallback;
}

/** Ids históricos del mismo canal y del mismo orden o nombre, para no perder oportunidades viejas al filtrar. */
export function equivalentPhaseIds(
    phases: readonly PhaseCatalogItem[] | null | undefined,
    targetPhaseId: number,
): number[] {
    if (!Number.isFinite(targetPhaseId) || targetPhaseId <= 0) return [targetPhaseId];
    const catalog = phases || [];
    const target = catalog.find(phase => Number(phase.id) === targetPhaseId);
    if (!target) return [targetPhaseId];

    const name = target.nombre?.trim().toLowerCase() ?? '';
    const canal = target.canal_id ?? null;
    const orden = numericOrden(target);
    const ids = new Set<number>();
    for (const phase of catalog) {
        if (canal && phase.canal_id !== canal) continue;
        const sameName = name.length > 0 && (phase.nombre?.trim().toLowerCase() ?? '') === name;
        const sameOrden = orden !== null && numericOrden(phase) === orden;
        if (!sameName && !sameOrden) continue;
        const id = Number(phase.id);
        if (Number.isFinite(id)) ids.add(id);
    }
    return ids.size > 0 ? Array.from(ids) : [targetPhaseId];
}

export function expandSelectedPhaseIds(
    selectedIds: readonly (number | string)[] | null | undefined,
    phases: readonly PhaseCatalogItem[] | null | undefined,
): number[] {
    const ids = new Set<number>();
    for (const raw of selectedIds || []) {
        const id = Number(raw);
        if (!Number.isFinite(id)) continue;
        for (const equivalent of equivalentPhaseIds(phases, id)) ids.add(equivalent);
    }
    return Array.from(ids);
}

export interface PhaseCatalogWritePlan {
    phasesToStore: PhaseCatalogItem[];
    phaseIdsToDelete: number[];
    labels: PhaseCatalogItem[];
}

/**
 * `db.phases` queda solo con las fases activas que devolvió el servidor.
 * `labels` conserva también las inactivas (locales o remotas) para los nombres históricos.
 * Si el servidor no devolvió activas, no se vacía el catálogo: solo se marcan para borrar las inactivas.
 */
export function planPhaseCatalogWrite(
    localPhases: readonly PhaseCatalogItem[] | null | undefined,
    remoteActivePhases: readonly PhaseCatalogItem[] | null | undefined,
    knownLabels: readonly PhaseCatalogItem[] | null | undefined = [],
): PhaseCatalogWritePlan {
    const local = localPhases || [];
    const remoteActive = (remoteActivePhases || []).filter(isSelectablePhase).map(phase => ({
        ...phase,
        id: Number(phase.id),
        is_active: true as const,
    }));

    if (remoteActive.length === 0) {
        return {
            phasesToStore: [],
            phaseIdsToDelete: local
                .filter(phase => phase.is_active === false)
                .map(phase => Number(phase.id))
                .filter(id => Number.isFinite(id)),
            labels: mergePhaseCatalog(knownLabels, local),
        };
    }

    const activeIds = new Set(remoteActive.map(phase => Number(phase.id)));
    return {
        phasesToStore: remoteActive,
        phaseIdsToDelete: local
            .map(phase => Number(phase.id))
            .filter(id => Number.isFinite(id) && !activeIds.has(id)),
        labels: mergePhaseCatalog(knownLabels, local, remoteActive),
    };
}
