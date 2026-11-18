import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildPhaseOutcomeMap,
    estadoIdForPhaseName,
    getPhaseOutcome,
    getPhaseOutcomeByName,
    splitPhaseIdsByOutcome,
} from '@/lib/opportunityPhase';
import { OPPORTUNITY_TABLE_COLUMN_KEYS } from '@/lib/opportunityTableHelpers';

const phases = [
    { id: 121, nombre: 'Cerrada ganada' },
    { id: 102, nombre: 'Cerrada Ganada' },
    { id: 122, nombre: 'Cerrada Perdida' },
    { id: 116, nombre: 'Primer contacto' },
    { id: 104, nombre: 'Visita' },
];

describe('Resultado de la oportunidad SOLO por fase', () => {
    it('clasifica por nombre sin importar mayúsculas ni tildes', () => {
        expect(getPhaseOutcomeByName('Cerrada ganada')).toBe('won');
        expect(getPhaseOutcomeByName('CERRADA GANADA')).toBe('won');
        expect(getPhaseOutcomeByName('Cerrada Pérdida')).toBe('lost');
        expect(getPhaseOutcomeByName('Negociación final')).toBe('open');
        expect(getPhaseOutcomeByName(null)).toBe('open');
    });

    it('usa el mapa fase_id -> resultado; sin fase = abierta', () => {
        const map = buildPhaseOutcomeMap(phases);
        expect(getPhaseOutcome(121, map)).toBe('won');
        expect(getPhaseOutcome('122', map)).toBe('lost');
        expect(getPhaseOutcome(116, map)).toBe('open');
        expect(getPhaseOutcome(null, map)).toBe('open');
        expect(getPhaseOutcome(999, map)).toBe('open');
    });

    it('separa ids ganadas / perdidas / cerradas', () => {
        expect(splitPhaseIdsByOutcome(phases)).toEqual({ won: [121, 102], lost: [122], closed: [121, 102, 122] });
    });

    it('estado_id por dentro: 1 abierta, 2 ganada, 3 perdida', () => {
        expect(estadoIdForPhaseName('Cerrada ganada')).toBe(2);
        expect(estadoIdForPhaseName('Cerrada Perdida')).toBe(3);
        expect(estadoIdForPhaseName('Visita')).toBe(1);
    });

    it('la tabla de oportunidades ya no tiene columna Estado', () => {
        expect(OPPORTUNITY_TABLE_COLUMN_KEYS).not.toContain('estado');
    });

    it('al cambiar de fase se sigue escribiendo estado_id por dentro (comisiones)', () => {
        const hook = readFileSync(path.join(process.cwd(), 'lib', 'hooks', 'useOpportunities.ts'), 'utf8');
        expect(hook).toContain('sanitizedUpdates.estado_id = await backgroundEstadoIdForPhase(sanitizedUpdates.fase_id');
        const detail = readFileSync(path.join(process.cwd(), 'app', 'oportunidades', '[id]', 'page.tsx'), 'utf8');
        expect(detail).toContain('estado_id: ESTADO_ID_GANADA');
        expect(detail).not.toMatch(/opportunity\.estado_id/);
    });
});
