import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateTotalAmount } from '@/lib/opportunityColumnFilterHelpers';
import { toBogotaStartOfDayISO } from '@/lib/dateFilterHelpers';
import {
    buildWonCloseDateOrFilter,
    listDateFilterTitle,
    listDateTodayLabel,
    listRangeUsesCloseDate,
    matchesOpportunityListDateRange,
    summarizeOpportunityListDateRange,
} from '@/lib/opportunityListDateFilter';

const root = process.cwd();
const START = '2026-11-01';
const END = '2026-11-24';

type Row = {
    id: string;
    created_at: string | null;
    fecha_cierre_estimada: string | null;
    amount: number;
};

// Misma regla que el listado: Ganadas usa fecha_cierre_estimada (YYYY-MM-DD, sin UTC).
// Si el cierre es null, cae a created_at para que la fila no desaparezca.
// Todas / Abiertas / Perdidas siguen en created_at.
const rows: Row[] = [
    { id: 'closed-in-created-before', created_at: '2026-08-02T15:00:00.000Z', fecha_cierre_estimada: '2026-11-10', amount: 40_000_000 },
    { id: 'closed-in-created-before-2', created_at: '2026-10-15T15:00:00.000Z', fecha_cierre_estimada: '2026-11-24', amount: 15_460_000 },
    { id: 'closed-in-created-in', created_at: '2026-11-03T15:00:00.000Z', fecha_cierre_estimada: '2026-11-03', amount: 8_840_000 },
    { id: 'closed-out-created-in', created_at: '2026-11-12T15:00:00.000Z', fecha_cierre_estimada: '2026-12-02', amount: 9_000_000 },
    { id: 'null-close-created-in', created_at: '2026-11-02T15:00:00.000Z', fecha_cierre_estimada: null, amount: 100_000 },
    { id: 'empty-close-created-in', created_at: '2026-11-04T15:00:00.000Z', fecha_cierre_estimada: '', amount: 50_000 },
    { id: 'null-close-created-before', created_at: '2026-10-01T15:00:00.000Z', fecha_cierre_estimada: null, amount: 500_000 },
    { id: 'boundary-start', created_at: '2025-01-01T15:00:00.000Z', fecha_cierre_estimada: '2026-11-01', amount: 1 },
];

describe('Rango superior del listado de oportunidades', () => {
    it('Ganadas usa fecha de cierre; el resto de pestañas sigue en created_at', () => {
        expect(listRangeUsesCloseDate('won')).toBe(true);
        expect(listRangeUsesCloseDate('all')).toBe(false);
        expect(listRangeUsesCloseDate('open')).toBe(false);
        expect(listRangeUsesCloseDate('lost')).toBe(false);
        expect(listDateFilterTitle('won')).toBe('Fecha de cierre');
        expect(listDateFilterTitle('open')).toBe('Fecha de Creación');
        expect(listDateTodayLabel('won')).toBe('Cerradas hoy');
        expect(listDateTodayLabel('lost')).toBe('Creadas hoy');
    });

    it('en Ganadas incluye cierre dentro del rango aunque se haya creado antes, y excluye cierre fuera', () => {
        const wonIds = rows
            .filter((row) => matchesOpportunityListDateRange(row, 'won', START, END))
            .map((row) => row.id);

        expect(wonIds).toEqual([
            'closed-in-created-before',
            'closed-in-created-before-2',
            'closed-in-created-in',
            'null-close-created-in',
            'empty-close-created-in',
            'boundary-start',
        ]);
        expect(matchesOpportunityListDateRange(
            { created_at: '2026-11-20T15:00:00.000Z', fecha_cierre_estimada: '2026-10-31' },
            'won',
            START,
            END,
        )).toBe(false);
    });

    it('sin fecha de cierre en una ganada, el rango cae a created_at', () => {
        expect(matchesOpportunityListDateRange(
            { created_at: '2026-11-18T18:00:00.000Z', fecha_cierre_estimada: null },
            'won',
            START,
            END,
        )).toBe(true);
        expect(matchesOpportunityListDateRange(
            { created_at: '2026-10-18T18:00:00.000Z', fecha_cierre_estimada: '   ' },
            'won',
            START,
            END,
        )).toBe(false);
    });

    it('Todas, Abiertas y Perdidas ignoran la fecha de cierre y filtran created_at', () => {
        const createdBeforeClosedIn = rows[0];
        const createdInClosedOut = rows[3];
        for (const status of ['all', 'open', 'lost'] as const) {
            expect(matchesOpportunityListDateRange(createdBeforeClosedIn, status, START, END)).toBe(false);
            expect(matchesOpportunityListDateRange(createdInClosedOut, status, START, END)).toBe(true);
        }
    });

    it('sin rango no descarta filas', () => {
        expect(matchesOpportunityListDateRange(rows[0], 'won', null, null)).toBe(true);
        expect(matchesOpportunityListDateRange(rows[6], 'open', null, null)).toBe(true);
    });

    it('Total de registros y Total valor salen del mismo conjunto filtrado', () => {
        const summary = summarizeOpportunityListDateRange(rows, 'won', START, END);
        expect(summary.count).toBe(summary.rows.length);
        expect(summary.totalAmount).toBe(calculateTotalAmount(summary.rows));
        expect(summary.count).toBe(6);
        expect(summary.totalAmount).toBe(40_000_000 + 15_460_000 + 8_840_000 + 100_000 + 50_000 + 1);

        const openSummary = summarizeOpportunityListDateRange(rows, 'open', START, END);
        expect(openSummary.rows.map((row) => row.id)).toEqual([
            'closed-in-created-in',
            'closed-out-created-in',
            'null-close-created-in',
            'empty-close-created-in',
        ]);
        expect(openSummary.count).toBe(4);
        expect(openSummary.totalAmount).toBe(8_840_000 + 9_000_000 + 100_000 + 50_000);
    });

    it('la consulta de Ganadas pide fecha_cierre_estimada y, si es null, created_at', () => {
        const filter = buildWonCloseDateOrFilter(START, END);
        expect(filter).toBeTruthy();
        expect(filter).toContain('and(fecha_cierre_estimada.gte.2026-11-01,fecha_cierre_estimada.lte.2026-11-24)');
        expect(filter).toContain('fecha_cierre_estimada.is.null');
        expect(filter).toMatch(/created_at\.gte\."[^"]+"/);
        expect(filter).toMatch(/created_at\.lte\."[^"]+"/);
        expect(filter).not.toContain('fecha_cierre_estimada.gte.2026-11-01T');

        const startIso = toBogotaStartOfDayISO(START);
        expect(startIso).toBeTruthy();
        expect(buildWonCloseDateOrFilter('2026-11-01', null)).toBe(
            `fecha_cierre_estimada.gte.2026-11-01,and(fecha_cierre_estimada.is.null,created_at.gte."${startIso}")`,
        );
        expect(buildWonCloseDateOrFilter(null, null)).toBeNull();
        expect(buildWonCloseDateOrFilter('no-es-fecha', 'tampoco')).toBeNull();
    });

    it('el servidor y el listado offline (Dexie) usan el mismo criterio, y el conteo comparte el filtro', () => {
        const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hook).toContain('buildWonCloseDateOrFilter(startDate, endDate)');
        expect(hook).toContain("q.or(wonDateOr)");
        expect(hook).toContain("q.gte('created_at', startISO)");
        expect(hook).toContain('matchesOpportunityListDateRange(o, statusFilter, startDate, endDate)');
        expect(hook).toContain('countQuery = applyCommonFilters(countQuery)');
        const offlineUsesMatcher = hook.includes(
            'localOpps = localOpps.filter(o => matchesOpportunityListDateRange(o, statusFilter, startDate, endDate))',
        );
        expect(offlineUsesMatcher).toBe(true);

        const quick = readFileSync(path.join(root, 'components', 'oportunidades', 'QuickDateFilter.tsx'), 'utf8');
        expect(quick).toContain('listDateFilterTitle(statusFilter)');
        expect(quick).toContain('listDateTodayLabel(statusFilter)');
    });
});
