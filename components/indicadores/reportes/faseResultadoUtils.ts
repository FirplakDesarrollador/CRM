// Resultado (abierta / ganada / perdida) de las oportunidades en los informes nativos de
// indicadores, calculado SOLO por la FASE (ver lib/opportunityPhase.ts). El estado ya no se usa.

import {
    PHASE_OUTCOME_LABELS,
    PHASE_OUTCOME_ORDER,
    buildPhaseOutcomeMap,
    getPhaseOutcome,
    type PhaseOutcome,
} from "@/lib/opportunityPhase";

export type ResultadoBucket = PhaseOutcome;

export const RESULTADO_BUCKET_LABELS: Record<ResultadoBucket, string> = PHASE_OUTCOME_LABELS;

export const RESULTADO_BUCKET_COLORS: Record<ResultadoBucket, string> = {
    open: "#3b82f6",
    won: "#22c55e",
    lost: "#ef4444",
};

export const RESULTADO_BUCKET_ORDER: ResultadoBucket[] = PHASE_OUTCOME_ORDER;

export { buildPhaseOutcomeMap };

export function getResultadoBucket(
    faseId: number | string | null | undefined,
    outcomeMap: Map<number, PhaseOutcome>
): ResultadoBucket {
    return getPhaseOutcome(faseId, outcomeMap);
}
