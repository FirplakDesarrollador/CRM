import { resolveActiveLostPhase, phaseLabelForId, type PhaseCatalogItem } from './opportunityPhaseCatalog';
import { ESTADO_ID_PERDIDA, getPhaseOutcomeByName } from './opportunityPhase';

export const WON_TO_LOST_CONFIRM_MESSAGE =
    'Esta oportunidad está en Cerrada ganada. Pasarla a Cerrada perdida afecta la comisión. ¿Desea continuar?';

export type LossReasonPlan =
    | { action: 'reason-only'; razonPerdida: string | null }
    | { action: 'close'; faseId: number; razonPerdida: string }
    | { action: 'confirm-won'; faseId: number; razonPerdida: string };

/**
 * Qué hacer al cambiar la razón de pérdida.
 * Una razón vacía no mueve la fase. Si la fase ya es perdida (activa o histórica),
 * solo se guarda la razón. Desde Cerrada ganada hay que confirmar, porque cambia la comisión.
 * En cualquier otra fase se cierra en la perdida activa del canal.
 */
export function planLossReasonSelection(input: {
    nextReason: string;
    faseId: number | string | null | undefined;
    phases: readonly PhaseCatalogItem[] | null | undefined;
    canalId?: string | null;
}): LossReasonPlan {
    const trimmed = input.nextReason.trim();
    if (!trimmed) return { action: 'reason-only', razonPerdida: null };

    const lost = resolveActiveLostPhase(input.phases, input.canalId);
    if (!lost) return { action: 'reason-only', razonPerdida: trimmed };

    const outcome = getPhaseOutcomeByName(phaseLabelForId(input.faseId, input.phases, ''));
    if (outcome === 'lost') return { action: 'reason-only', razonPerdida: trimmed };
    if (outcome === 'won') {
        return { action: 'confirm-won', faseId: Number(lost.id), razonPerdida: trimmed };
    }
    return { action: 'close', faseId: Number(lost.id), razonPerdida: trimmed };
}

export interface ClosedLostPhaseUpdate {
    fase_id: number;
    razon_perdida: string;
    comentarios_perdida: string;
    estado_id: typeof ESTADO_ID_PERDIDA;
    probability: number;
    fecha_cierre_estimada?: string;
}

/**
 * Mismos campos que el stepper escribe al pulsar CERRADA PERDIDA:
 * fase activa, estado 3, razón, comentarios y probabilidad. En B2C también la fecha de cierre.
 */
export function buildClosedLostPhaseUpdate(input: {
    phaseId: number;
    probability?: number | null;
    razonPerdida: string;
    comentariosPerdida?: string | null;
    isB2C: boolean;
    today: string;
}): ClosedLostPhaseUpdate {
    const updates: ClosedLostPhaseUpdate = {
        fase_id: input.phaseId,
        razon_perdida: input.razonPerdida,
        comentarios_perdida: input.comentariosPerdida ?? '',
        estado_id: ESTADO_ID_PERDIDA,
        probability: input.probability ?? 0,
    };
    if (input.isB2C) updates.fecha_cierre_estimada = input.today;
    return updates;
}
