/**
 * Filtro de estado (Abiertas / Ganadas / Perdidas) de la tabla de Oportunidades.
 *
 * Una oportunidad cuenta como ganada si su estado es ganado (2 o 11) O su fase es "Cerrada ganada",
 * y como perdida si su estado es perdido (3, 4 o 14) O su fase es "Cerrada perdida".
 * Así no se pierden las que quedaron con la fase cerrada y el estado sin actualizar (y viceversa).
 * "Abiertas" excluye las que tengan estado cerrado o fase cerrada.
 */

export type OpportunityStatusFilter = 'all' | 'open' | 'won' | 'lost';

export const WON_STATE_IDS = [2, 11] as const;
export const LOST_STATE_IDS = [3, 4, 14] as const;
export const CLOSED_STATE_IDS = [...WON_STATE_IDS, ...LOST_STATE_IDS] as const;

export type PhaseLike = { id: number; nombre: string };

export function splitClosedPhaseIds(phases: PhaseLike[]): { won: number[]; lost: number[] } {
    const won: number[] = [];
    const lost: number[] = [];
    for (const p of phases || []) {
        const nombre = String(p?.nombre || '').toLowerCase();
        if (nombre.includes('ganada')) won.push(Number(p.id));
        else if (nombre.includes('perdida')) lost.push(Number(p.id));
    }
    return { won, lost };
}

const inList = (ids: readonly number[]) => `(${ids.join(',')})`;

/**
 * Condición PostgREST (para `.or(...)`) de Ganadas o Perdidas: estado O fase.
 * Devuelve null para 'all' y 'open' (Abiertas usa buildOpenPhaseOrCondition + exclusión de estados).
 */
export function buildClosedStatusOrCondition(
    status: OpportunityStatusFilter,
    wonPhaseIds: number[],
    lostPhaseIds: number[]
): string | null {
    if (status === 'won') {
        const parts = [`estado_id.in.${inList(WON_STATE_IDS)}`];
        if (wonPhaseIds.length > 0) parts.push(`fase_id.in.${inList(wonPhaseIds)}`);
        return parts.join(',');
    }
    if (status === 'lost') {
        const parts = [`estado_id.in.${inList(LOST_STATE_IDS)}`];
        if (lostPhaseIds.length > 0) parts.push(`fase_id.in.${inList(lostPhaseIds)}`);
        return parts.join(',');
    }
    return null;
}

/** Condición PostgREST de "fase no cerrada" para Abiertas (las sin fase/prospecto siguen contando). */
export function buildOpenPhaseOrCondition(closedPhaseIds: number[]): string | null {
    if (closedPhaseIds.length === 0) return null;
    return `fase_id.is.null,fase_id.not.in.${inList(closedPhaseIds)}`;
}

export const OPEN_EXCLUDED_STATES_IN = inList(CLOSED_STATE_IDS);

/** Misma regla para el modo offline (Dexie). */
export function matchesStatusFilter(
    opp: { estado_id?: number | string | null; fase_id?: number | string | null },
    status: OpportunityStatusFilter,
    wonPhaseIds: number[],
    lostPhaseIds: number[]
): boolean {
    if (status === 'all') return true;
    const estado = opp.estado_id === null || opp.estado_id === undefined || opp.estado_id === '' ? null : Number(opp.estado_id);
    const fase = opp.fase_id === null || opp.fase_id === undefined || opp.fase_id === '' ? null : Number(opp.fase_id);
    const wonByState = estado !== null && (WON_STATE_IDS as readonly number[]).includes(estado);
    const lostByState = estado !== null && (LOST_STATE_IDS as readonly number[]).includes(estado);
    const wonByPhase = fase !== null && wonPhaseIds.includes(fase);
    const lostByPhase = fase !== null && lostPhaseIds.includes(fase);
    if (status === 'won') return wonByState || wonByPhase;
    if (status === 'lost') return lostByState || lostByPhase;
    // open
    return !wonByState && !lostByState && !wonByPhase && !lostByPhase;
}

/** Filtro de Setter: 'CO', 'REC' o 'NONE' (sin setter). */
export type SetterFilter = 'CO' | 'REC' | 'NONE';

export const SETTER_FILTER_OPTIONS: Array<{ id: SetterFilter; label: string }> = [
    { id: 'CO', label: 'CO' },
    { id: 'REC', label: 'REC' },
    { id: 'NONE', label: 'Ninguna' },
];

export function normalizeSetterFilter(value: string | null | undefined): SetterFilter | null {
    const v = String(value ?? '').trim().toUpperCase();
    if (v === 'CO' || v === 'REC' || v === 'NONE') return v;
    return null;
}

export function matchesSetterFilter(setter: string | null | undefined, filter: SetterFilter | null): boolean {
    if (!filter) return true;
    const v = String(setter ?? '').trim().toUpperCase();
    if (filter === 'NONE') return v === '';
    return v === filter;
}
