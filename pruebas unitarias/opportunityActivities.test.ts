import { describe, expect, it } from 'vitest';
import { computeOpportunityActivitySummary } from '@/lib/opportunityActivities';

describe('Cálculo y clasificación de Actividades en Oportunidades', () => {
    const baseNow = new Date('2026-09-02T12:00:00Z');

    it('identifica oportunidades sin actividades', () => {
        const resultNull = computeOpportunityActivitySummary(null, baseNow);
        expect(resultNull.hasActivity).toBe(false);
        expect(resultNull.status).toBe('none');
        expect(resultNull.label).toBe('Sin actividad');
        expect(resultNull.total).toBe(0);

        const resultEmpty = computeOpportunityActivitySummary([], baseNow);
        expect(resultEmpty.hasActivity).toBe(false);
        expect(resultEmpty.status).toBe('none');
    });

    it('identifica actividades atrasadas (fecha_fin en el pasado y no completada)', () => {
        const activities = [
            { id: '1', fecha_fin: '2026-09-01T10:00:00Z', is_completed: false },
            { id: '2', fecha_fin: '2026-08-30T10:00:00Z', is_completed: false },
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.hasActivity).toBe(true);
        expect(result.status).toBe('overdue');
        expect(result.overdue).toBe(2);
        expect(result.scheduled).toBe(0);
        expect(result.label).toBe('2 atrasadas');
    });

    it('identifica actividades programadas a futuro en azul (fecha_fin en el futuro y no completada)', () => {
        const activities = [
            { id: '1', fecha_fin: '2026-09-05T10:00:00Z', is_completed: false },
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.hasActivity).toBe(true);
        expect(result.status).toBe('scheduled');
        expect(result.overdue).toBe(0);
        expect(result.scheduled).toBe(1);
        expect(result.label).toBe('1 programada');
    });

    it('prioriza estado atrasado si existen actividades atrasadas y programadas simultáneamente', () => {
        const activities = [
            { id: '1', fecha_fin: '2026-09-01T10:00:00Z', is_completed: false }, // Atrasada
            { id: '2', fecha_fin: '2026-09-10T10:00:00Z', is_completed: false }, // Programada
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.hasActivity).toBe(true);
        expect(result.status).toBe('overdue');
        expect(result.overdue).toBe(1);
        expect(result.scheduled).toBe(1);
        expect(result.label).toBe('1 atrasada (1 prog.)');
    });

    it('ignora actividades eliminadas lógicamente (is_deleted: true)', () => {
        const activities = [
            { id: '1', fecha_fin: '2026-09-01T10:00:00Z', is_completed: false, is_deleted: true },
            { id: '2', fecha_fin: '2026-09-08T10:00:00Z', is_completed: false, is_deleted: false },
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.hasActivity).toBe(true);
        expect(result.status).toBe('scheduled');
        expect(result.overdue).toBe(0);
        expect(result.scheduled).toBe(1);
        expect(result.total).toBe(1);
    });

    it('indica cuando todas las actividades están completadas', () => {
        const activities = [
            { id: '1', fecha_fin: '2026-09-01T10:00:00Z', is_completed: true },
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.hasActivity).toBe(true);
        expect(result.status).toBe('completed');
        expect(result.completed).toBe(1);
        expect(result.overdue).toBe(0);
        expect(result.scheduled).toBe(0);
        expect(result.label).toBe('1 al día');
    });

    it('clasifica como programada una TAREA con fecha_inicio futura aunque fecha_fin sea del pasado o residual', () => {
        const activities = [
            {
                id: 'task-1',
                tipo_actividad: 'TAREA',
                fecha_inicio: '2026-09-09T10:00:00Z', // Futura respecto a baseNow (2026-09-02)
                fecha_fin: '2026-09-02T11:00:00Z',    // Residual en el pasado
                is_completed: false
            }
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.hasActivity).toBe(true);
        expect(result.status).toBe('scheduled');
        expect(result.overdue).toBe(0);
        expect(result.scheduled).toBe(1);
        expect(result.label).toBe('1 programada');
    });

    it('corrige discrepancia cuando fecha_fin es anterior a fecha_inicio en cualquier actividad', () => {
        const activities = [
            {
                id: 'act-inconsistent',
                fecha_inicio: '2026-09-05T10:00:00Z',
                fecha_fin: '2026-09-01T10:00:00Z',
                is_completed: false
            }
        ];

        const result = computeOpportunityActivitySummary(activities, baseNow);
        expect(result.status).toBe('scheduled');
        expect(result.overdue).toBe(0);
        expect(result.scheduled).toBe(1);
        expect(result.label).toBe('1 programada');
    });
});

