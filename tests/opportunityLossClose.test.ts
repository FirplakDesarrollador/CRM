import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ESTADO_ID_PERDIDA } from '@/lib/opportunityPhase';
import { resolveActiveLostPhase, resolveShownPhaseId, resolveStepperPhaseId } from '@/lib/opportunityPhaseCatalog';
import {
    WON_TO_LOST_CONFIRM_MESSAGE,
    buildClosedLostPhaseUpdate,
    planLossReasonSelection,
} from '@/lib/opportunityLossClose';

/** PROPIO: inactivas 82-88 comparten orden con las activas 116-122. La perdida activa es 122. */
const PROPIO = [
    { id: 82, nombre: 'Primer contacto', orden: 1, canal_id: 'PROPIO', is_active: false, probability: 10 },
    { id: 87, nombre: 'Cerrada ganada', orden: 6, canal_id: 'PROPIO', is_active: false, probability: 100 },
    { id: 88, nombre: 'Cerrada Perdida', orden: 7, canal_id: 'PROPIO', is_active: false, probability: 0 },
    { id: 116, nombre: 'Primer contacto', orden: 1, canal_id: 'PROPIO', is_active: true, probability: 10 },
    { id: 121, nombre: 'Cerrada ganada', orden: 6, canal_id: 'PROPIO', is_active: true, probability: 100 },
    { id: 122, nombre: 'Cerrada Perdida', orden: 7, canal_id: 'PROPIO', is_active: true, probability: 0 },
    { id: 200, nombre: 'Cerrada Perdida', orden: 9, canal_id: 'OBRAS_NAC', is_active: true, probability: 0 },
];

const root = process.cwd();
const page = () => readFileSync(path.join(root, 'app', 'oportunidades', '[id]', 'page.tsx'), 'utf8');

describe('Fase activa de Cerrada perdida', () => {
    it('en PROPIO resuelve la fase activa 122 y no la inactiva 88', () => {
        expect(resolveActiveLostPhase(PROPIO, 'PROPIO')?.id).toBe(122);
        expect(resolveActiveLostPhase(PROPIO, 'OBRAS_NAC')?.id).toBe(200);
        expect(resolveActiveLostPhase(PROPIO, null)).toBeNull();
    });

    it('si hay varias perdidas activas, se queda con el nombre Cerrada perdida y el menor orden', () => {
        const phases = [
            { id: 9, nombre: 'Prospecto frío', orden: 2, canal_id: 'PROPIO', is_active: true },
            { id: 4, nombre: 'Cerrada perdida', orden: 8, canal_id: 'PROPIO', is_active: true },
            { id: 3, nombre: 'Cerrada Perdida', orden: 7, canal_id: 'PROPIO', is_active: true },
        ];
        expect(resolveActiveLostPhase(phases, 'PROPIO')?.id).toBe(3);
    });
});

describe('Badge y stepper muestran la misma fase', () => {
    it('una perdida inactiva del mismo orden se ve como la activa 122', () => {
        expect(resolveShownPhaseId(88, PROPIO, 'PROPIO')).toBe(122);
        expect(resolveShownPhaseId(122, PROPIO, 'PROPIO')).toBe(122);
        expect(resolveShownPhaseId(116, PROPIO, 'PROPIO')).toBe(116);
        expect(resolveStepperPhaseId(88, PROPIO, 'PROPIO')).toBe(122);
    });

    it('si el orden de la perdida histórica ya no es la perdida activa, ambos usan la perdida activa', () => {
        const drifted = [
            { id: 50, nombre: 'Cerrada Perdida', orden: 3, canal_id: 'PROPIO', is_active: false, probability: 0 },
            { id: 118, nombre: 'Acuerdo de precios', orden: 3, canal_id: 'PROPIO', is_active: true, probability: 40 },
            { id: 122, nombre: 'Cerrada Perdida', orden: 7, canal_id: 'PROPIO', is_active: true, probability: 0 },
        ];
        expect(resolveStepperPhaseId(50, drifted, 'PROPIO')).toBe(118);
        expect(resolveShownPhaseId(50, drifted, 'PROPIO')).toBe(122);
    });

    it('un texto legado Cerrada Perdida sin fase en el catálogo también señala la perdida activa', () => {
        expect(resolveShownPhaseId(999, PROPIO, 'PROPIO', 'Cerrada Perdida')).toBe(122);
        expect(resolveShownPhaseId(116, PROPIO, 'PROPIO', 'Cerrada Perdida')).toBe(116);
    });
});

describe('Elegir razón de pérdida cierra con el mismo payload que el stepper', () => {
    it('una razón vacía no cambia la fase', () => {
        expect(planLossReasonSelection({
            nextReason: '   ',
            faseId: 116,
            phases: PROPIO,
            canalId: 'PROPIO',
        })).toEqual({ action: 'reason-only', razonPerdida: null });
    });

    it('en una fase abierta mueve a la perdida activa del canal', () => {
        expect(planLossReasonSelection({
            nextReason: 'INT - Abandona Conversación',
            faseId: 116,
            phases: PROPIO,
            canalId: 'PROPIO',
        })).toEqual({
            action: 'close',
            faseId: 122,
            razonPerdida: 'INT - Abandona Conversación',
        });
    });

    it('si ya está cerrada como perdida, aunque sea la inactiva, solo guarda la razón', () => {
        expect(planLossReasonSelection({
            nextReason: 'INT - Precio Elevado',
            faseId: 88,
            phases: PROPIO,
            canalId: 'PROPIO',
        }).action).toBe('reason-only');
        expect(planLossReasonSelection({
            nextReason: 'INT - Precio Elevado',
            faseId: 122,
            phases: PROPIO,
            canalId: 'PROPIO',
        }).action).toBe('reason-only');
    });

    it('desde Cerrada ganada pide confirmación y el destino sigue siendo la perdida activa', () => {
        expect(planLossReasonSelection({
            nextReason: 'INT - Abandona Conversación',
            faseId: 121,
            phases: PROPIO,
            canalId: 'PROPIO',
        })).toEqual({
            action: 'confirm-won',
            faseId: 122,
            razonPerdida: 'INT - Abandona Conversación',
        });
        expect(planLossReasonSelection({
            nextReason: 'Duplicado',
            faseId: 87,
            phases: PROPIO,
            canalId: 'PROPIO',
        }).action).toBe('confirm-won');
        expect(WON_TO_LOST_CONFIRM_MESSAGE.toLowerCase()).toContain('comisi');
    });

    it('sin fase perdida activa en el canal no inventa un fase_id', () => {
        expect(planLossReasonSelection({
            nextReason: 'Duplicado',
            faseId: 116,
            phases: PROPIO.filter(phase => phase.id !== 122 && phase.id !== 88),
            canalId: 'PROPIO',
        })).toEqual({ action: 'reason-only', razonPerdida: 'Duplicado' });
    });

    it('el payload de cierre lleva fase activa, estado 3 y la razón, igual que CERRADA PERDIDA', () => {
        expect(buildClosedLostPhaseUpdate({
            phaseId: 122,
            probability: 0,
            razonPerdida: 'INT - Abandona Conversación',
            comentariosPerdida: 'no volvió a escribir',
            isB2C: false,
            today: '2026-11-24',
        })).toEqual({
            fase_id: 122,
            razon_perdida: 'INT - Abandona Conversación',
            comentarios_perdida: 'no volvió a escribir',
            estado_id: ESTADO_ID_PERDIDA,
            probability: 0,
        });
        expect(ESTADO_ID_PERDIDA).toBe(3);
    });

    it('en canal propio completa la fecha de cierre, igual que el stepper', () => {
        expect(buildClosedLostPhaseUpdate({
            phaseId: 122,
            probability: null,
            razonPerdida: 'Duplicado',
            comentariosPerdida: '',
            isB2C: true,
            today: '2026-11-24',
        })).toMatchObject({
            fase_id: 122,
            estado_id: 3,
            probability: 0,
            fecha_cierre_estimada: '2026-11-24',
            comentarios_perdida: '',
        });
    });
});

describe('El detalle usa un solo camino de guardado', () => {
    it('la razón y el botón CERRADA PERDIDA persisten con el mismo helper', () => {
        const source = page();
        const select = source.slice(
            source.indexOf('data-testid="razon-perdida-select"'),
            source.indexOf('data-testid="comentarios-perdida-textarea"'),
        );
        expect(select).toContain('planLossReasonSelection');
        expect(select).toContain('persistClosedLost');
        expect(select).toContain('window.confirm(WON_TO_LOST_CONFIRM_MESSAGE)');
        expect(select).not.toContain('razon_perdida: e.target.value');

        const change = source.slice(source.indexOf('const handlePhaseChange'), source.indexOf('const confirmLossReason'));
        expect(change).toContain('persistClosedLost(phaseId, localRazonPerdida)');
        expect(change).not.toContain('estado_id: ESTADO_ID_PERDIDA');

        const persist = source.slice(source.indexOf('const persistClosedLost'), source.indexOf('const handlePhaseChange'));
        expect(persist).toContain('buildClosedLostPhaseUpdate');
        expect(persist).toContain('updateOpportunity(opportunity.id, updates)');

        expect(source).toContain('resolveShownPhaseId(opportunity.fase_id');
        expect(source).toContain('highlightedPhaseId = resolveShownPhaseId');
        expect(source).not.toContain('phaseMap.get(opportunity.fase_id)');
    });
});
