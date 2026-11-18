import { supabase } from '@/lib/supabase';
import { splitPhaseIdsByOutcome } from '@/lib/opportunityPhase';

/**
 * IDs de las fases cerradas (ganada / perdida) leídos de CRM_FasesOportunidad.
 * Se usan para filtrar oportunidades ABIERTAS por fase en consultas al servidor
 * (el estado ya no se usa). Se cachea por sesión del navegador.
 */
let cache: Promise<{ won: number[]; lost: number[]; closed: number[] }> | null = null;

export function fetchPhaseIdsByOutcome(): Promise<{ won: number[]; lost: number[]; closed: number[] }> {
    if (!cache) {
        cache = (async () => {
            const { data, error } = await supabase.from('CRM_FasesOportunidad').select('id, nombre');
            if (error) {
                cache = null;
                throw new Error(error.message);
            }
            return splitPhaseIdsByOutcome((data || []) as Array<{ id: number; nombre: string }>);
        })();
    }
    return cache;
}

/** Condición PostgREST (para `.or(...)`) de "fase abierta": sin fase o fase no cerrada. */
export function openPhaseOrCondition(closedPhaseIds: number[]): string | null {
    if (closedPhaseIds.length === 0) return null;
    return `fase_id.is.null,fase_id.not.in.(${closedPhaseIds.join(',')})`;
}

/** Aplica el filtro "solo abiertas por fase" a una consulta de CRM_Oportunidades. */
export async function onlyOpenByPhase<Q extends { or: (filters: string) => Q }>(query: Q): Promise<Q> {
    const { closed } = await fetchPhaseIdsByOutcome();
    const cond = openPhaseOrCondition(closed);
    return cond ? query.or(cond) : query;
}
