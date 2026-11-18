/**
 * Filtro de resultado (Abiertas / Ganadas / Perdidas) de la tabla de Oportunidades.
 *
 * Se calcula SOLO por la FASE (ver lib/opportunityPhase.ts): ganada = fase "Cerrada ganada",
 * perdida = fase "Cerrada perdida", abierta = cualquier otra fase o sin fase.
 * El estado (estado_id) ya no se usa para filtrar.
 */

import { splitPhaseIdsByOutcome, type PhaseLike as PhaseLikeBase } from './opportunityPhase';

export type OpportunityStatusFilter = 'all' | 'open' | 'won' | 'lost';

export type PhaseLike = { id: number; nombre: string };

export function splitClosedPhaseIds(phases: PhaseLikeBase[]): { won: number[]; lost: number[] } {
    const { won, lost } = splitPhaseIdsByOutcome(phases);
    return { won, lost };
}

const inList = (ids: readonly number[]) => `(${ids.join(',')})`;

/**
 * Condición PostgREST (para `.or(...)`) de Ganadas o Perdidas por fase.
 * Si no hay fases de ese tipo devuelve una condición que no trae nada.
 * Devuelve null para 'all' y 'open' (Abiertas usa buildOpenPhaseOrCondition).
 */
export function buildClosedStatusOrCondition(
    status: OpportunityStatusFilter,
    wonPhaseIds: number[],
    lostPhaseIds: number[]
): string | null {
    if (status === 'won') {
        return wonPhaseIds.length > 0 ? `fase_id.in.${inList(wonPhaseIds)}` : 'fase_id.eq.-1';
    }
    if (status === 'lost') {
        return lostPhaseIds.length > 0 ? `fase_id.in.${inList(lostPhaseIds)}` : 'fase_id.eq.-1';
    }
    return null;
}

/** Condición PostgREST de "fase no cerrada" para Abiertas (las sin fase/prospecto siguen contando). */
export function buildOpenPhaseOrCondition(closedPhaseIds: number[]): string | null {
    if (closedPhaseIds.length === 0) return null;
    return `fase_id.is.null,fase_id.not.in.${inList(closedPhaseIds)}`;
}

/** Misma regla para el modo offline (Dexie). Solo mira la fase. */
export function matchesStatusFilter(
    opp: { fase_id?: number | string | null },
    status: OpportunityStatusFilter,
    wonPhaseIds: number[],
    lostPhaseIds: number[]
): boolean {
    if (status === 'all') return true;
    const fase = opp.fase_id === null || opp.fase_id === undefined || opp.fase_id === '' ? null : Number(opp.fase_id);
    const won = fase !== null && wonPhaseIds.includes(fase);
    const lost = fase !== null && lostPhaseIds.includes(fase);
    if (status === 'won') return won;
    if (status === 'lost') return lost;
    return !won && !lost;
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
