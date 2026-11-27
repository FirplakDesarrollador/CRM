/**
 * Resultado de una oportunidad (abierta / ganada / perdida) calculado SOLO por su FASE.
 *
 * El CRM ya no muestra ni usa `estado_id` para lógica de interfaz: todo se deriva de la fase
 * (CRM_FasesOportunidad). Como la tabla de fases no tiene una columna de tipo de cierre,
 * la fase se clasifica por su nombre ("Cerrada ganada" / "Cerrada Perdida"), sin importar
 * mayúsculas ni tildes. Cualquier otra fase (o sin fase) cuenta como abierta.
 *
 * `estado_id` se sigue escribiendo por dentro (ver `estadoIdForPhase`) solo para que los
 * triggers de comisiones, la export-api y n8n sigan funcionando. No se debe leer en la UI.
 */

export type PhaseOutcome = 'open' | 'won' | 'lost';

export type PhaseLike = { id: number | string; nombre?: string | null };

export const PHASE_OUTCOME_LABELS: Record<PhaseOutcome, string> = {
    open: 'Abierta',
    won: 'Cerrada ganada',
    lost: 'Cerrada perdida',
};

export const PHASE_OUTCOME_ORDER: PhaseOutcome[] = ['open', 'won', 'lost'];

/** Minúsculas y sin tildes. */
export function normalizePhaseName(nombre?: string | null): string {
    return String(nombre ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/** Clasifica una fase por su nombre. */
export function getPhaseOutcomeByName(nombre?: string | null): PhaseOutcome {
    const n = normalizePhaseName(nombre);
    if (!n) return 'open';
    if (n.includes('ganad')) return 'won';
    if (n.includes('perdid')) return 'lost';
    return 'open';
}

export function isClosedPhaseName(nombre?: string | null): boolean {
    return getPhaseOutcomeByName(nombre) !== 'open';
}

/** Mapa fase_id -> resultado, a partir de la lista de fases. */
export function buildPhaseOutcomeMap(phases: PhaseLike[] | null | undefined): Map<number, PhaseOutcome> {
    const map = new Map<number, PhaseOutcome>();
    for (const p of phases || []) {
        const id = Number(p?.id);
        if (!Number.isFinite(id)) continue;
        map.set(id, getPhaseOutcomeByName(p?.nombre));
    }
    return map;
}

/** Resultado de una oportunidad según su fase_id (sin fase o fase desconocida = abierta). */
export function getPhaseOutcome(
    faseId: number | string | null | undefined,
    outcomeMap: Map<number, PhaseOutcome>
): PhaseOutcome {
    if (faseId === null || faseId === undefined || faseId === '') return 'open';
    return outcomeMap.get(Number(faseId)) ?? 'open';
}

/** IDs de fases ganadas / perdidas / cerradas. */
export function splitPhaseIdsByOutcome(phases: PhaseLike[] | null | undefined): {
    won: number[];
    lost: number[];
    closed: number[];
} {
    const won: number[] = [];
    const lost: number[] = [];
    for (const p of phases || []) {
        const id = Number(p?.id);
        if (!Number.isFinite(id)) continue;
        const outcome = getPhaseOutcomeByName(p?.nombre);
        if (outcome === 'won') won.push(id);
        else if (outcome === 'lost') lost.push(id);
    }
    return { won, lost, closed: [...won, ...lost] };
}

/**
 * Valor de `estado_id` que se guarda EN SEGUNDO PLANO al crear o cambiar de fase
 * (1 = Abierta, 2 = Ganada, 3 = Perdida). Solo para compatibilidad con triggers/integraciones.
 */
export const ESTADO_ID_ABIERTA = 1;
export const ESTADO_ID_GANADA = 2;
export const ESTADO_ID_PERDIDA = 3;

export function estadoIdForOutcome(outcome: PhaseOutcome): 1 | 2 | 3 {
    if (outcome === 'won') return ESTADO_ID_GANADA;
    if (outcome === 'lost') return ESTADO_ID_PERDIDA;
    return ESTADO_ID_ABIERTA;
}

export function estadoIdForPhaseName(nombre?: string | null): 1 | 2 | 3 {
    return estadoIdForOutcome(getPhaseOutcomeByName(nombre));
}
