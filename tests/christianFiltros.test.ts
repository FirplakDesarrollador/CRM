import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildClosedStatusOrCondition,
    buildOpenPhaseOrCondition,
    matchesStatusFilter,
    matchesSetterFilter,
    normalizeSetterFilter,
    splitClosedPhaseIds,
    OPEN_EXCLUDED_STATES_IN,
} from '@/lib/opportunityStatusFilter';
import { toDateOnly, formatDateOnlyDMY, isDateOnlyInRange, isDateOnlyOverdue } from '@/lib/dateFilterHelpers';
import { buildOpportunityHotRow } from '@/lib/opportunityTableHelpers';
import { isToolbarOwnedTableColumn } from '@/lib/tableFilterPolicy';
import { isColumnFilterActive } from '@/lib/opportunityColumnFilterHelpers';

const root = process.cwd();
const phases = [
    { id: 121, nombre: 'Cerrada ganada' },
    { id: 122, nombre: 'Cerrada Perdida' },
    { id: 102, nombre: 'Cerrada Ganada' },
    { id: 103, nombre: 'Cerrada Perdida' },
    { id: 116, nombre: 'Primer contacto' },
];
const { won, lost } = splitClosedPhaseIds(phases);

describe('Filtro Ganada/Perdida/Abiertas por estado O fase (casos de Christian)', () => {
    it('separa fases cerradas ganadas y perdidas', () => {
        expect(won).toEqual([121, 102]);
        expect(lost).toEqual([122, 103]);
    });

    it('Ganada acepta estado ganado (2 u 11) o fase Cerrada ganada', () => {
        expect(matchesStatusFilter({ estado_id: 2, fase_id: 116 }, 'won', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: 11, fase_id: null }, 'won', won, lost)).toBe(true);
        // fase Cerrada ganada con estado Abierta (las 80 cruzadas)
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 121 }, 'won', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: '8', fase_id: '102' }, 'won', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 116 }, 'won', won, lost)).toBe(false);
    });

    it('Perdida acepta estado perdido o fase Cerrada perdida', () => {
        expect(matchesStatusFilter({ estado_id: 3, fase_id: 116 }, 'lost', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: 14, fase_id: 116 }, 'lost', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 122 }, 'lost', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 121 }, 'lost', won, lost)).toBe(false);
    });

    it('Abiertas excluye estado cerrado y fase cerrada', () => {
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 116 }, 'open', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: null, fase_id: null }, 'open', won, lost)).toBe(true);
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 121 }, 'open', won, lost)).toBe(false);
        expect(matchesStatusFilter({ estado_id: 1, fase_id: 122 }, 'open', won, lost)).toBe(false);
        expect(matchesStatusFilter({ estado_id: 2, fase_id: 116 }, 'open', won, lost)).toBe(false);
        expect(matchesStatusFilter({ estado_id: 4, fase_id: 116 }, 'all', won, lost)).toBe(true);
    });

    it('arma las condiciones PostgREST del servidor', () => {
        expect(buildClosedStatusOrCondition('won', won, lost)).toBe('estado_id.in.(2,11),fase_id.in.(121,102)');
        expect(buildClosedStatusOrCondition('lost', won, lost)).toBe('estado_id.in.(3,4,14),fase_id.in.(122,103)');
        expect(buildClosedStatusOrCondition('won', [], [])).toBe('estado_id.in.(2,11)');
        expect(buildClosedStatusOrCondition('open', won, lost)).toBeNull();
        expect(buildOpenPhaseOrCondition([...won, ...lost])).toBe('fase_id.is.null,fase_id.not.in.(121,102,122,103)');
        expect(buildOpenPhaseOrCondition([])).toBeNull();
        expect(OPEN_EXCLUDED_STATES_IN).toBe('(2,11,3,4,14)');
    });

    it('el hook usa estas condiciones en el servidor y en offline', () => {
        const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hook).toContain('buildClosedStatusOrCondition(statusFilter');
        expect(hook).toContain('buildOpenPhaseOrCondition(closedPhaseIdsRef.current)');
        expect(hook).toContain('matchesStatusFilter(o, statusFilter');
        expect(hook).not.toContain("q.in('estado_id', [2, 11])");
    });
});

describe('Setter como filtro de servidor', () => {
    it('la columna Setter queda como filtro de servidor (no del menú nativo)', () => {
        expect(isToolbarOwnedTableColumn('oportunidades', 'setter')).toBe(true);
        expect(isColumnFilterActive('setter', { setter: 'CO' })).toBe(true);
        expect(isColumnFilterActive('setter', { setter: null })).toBe(false);
    });

    it('normaliza y compara CO / REC / Ninguna', () => {
        expect(normalizeSetterFilter(' co ')).toBe('CO');
        expect(normalizeSetterFilter('NONE')).toBe('NONE');
        expect(normalizeSetterFilter('otro')).toBeNull();
        expect(matchesSetterFilter('CO', 'CO')).toBe(true);
        expect(matchesSetterFilter('rec ', 'REC')).toBe(true);
        expect(matchesSetterFilter('CO', 'REC')).toBe(false);
        expect(matchesSetterFilter(null, 'NONE')).toBe(true);
        expect(matchesSetterFilter('', 'NONE')).toBe(true);
        expect(matchesSetterFilter('CO', 'NONE')).toBe(false);
        expect(matchesSetterFilter('CO', null)).toBe(true);
    });

    it('el hook filtra setter en la consulta y la página conecta el popover', () => {
        const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hook).toContain("q.is('setter', null)");
        expect(hook).toContain("q.eq('setter', setterFilter)");
        const page = readFileSync(path.join(root, 'app', 'oportunidades', 'page.tsx'), 'utf8');
        expect(page).toContain('selectedSetter={setterFilter}');
        expect(page).toContain("params.set('setter', setterFilter)");
        const pop = readFileSync(path.join(root, 'components', 'oportunidades', 'FloatingColumnFilterPopover.tsx'), 'utf8');
        expect(pop).toContain("anchor.colKey === 'setter'");
    });
});

describe('Fechas "solo día" sin corrimiento por zona horaria', () => {
    it('toDateOnly y formatDateOnlyDMY no pasan por UTC', () => {
        expect(toDateOnly('2026-11-30')).toBe('2026-11-30');
        expect(toDateOnly('2026-11-30T00:00:00')).toBe('2026-11-30');
        expect(toDateOnly(null)).toBeNull();
        expect(formatDateOnlyDMY('2026-11-01')).toBe('01/11/2026');
        expect(formatDateOnlyDMY('')).toBeNull();
    });

    it('la columna Cierre muestra el mismo día guardado', () => {
        const row = buildOpportunityHotRow({ id: 'x', fecha_cierre_estimada: '2026-11-01' } as any, {} as any);
        expect(row.cierre).toBe('01/11/2026');
        const noDate = buildOpportunityHotRow({ id: 'y', fecha_cierre_estimada: null } as any, {} as any);
        expect(noDate.cierre).toBe('-');
        expect(noDate.cierre_overdue).toBe(false);
    });

    it('rango offline inclusivo en los dos extremos', () => {
        expect(isDateOnlyInRange('2026-11-01', '2026-11-01', '2026-11-30')).toBe(true);
        expect(isDateOnlyInRange('2026-11-30', '2026-11-01', '2026-11-30')).toBe(true);
        expect(isDateOnlyInRange('2026-10-31', '2026-11-01', '2026-11-30')).toBe(false);
        expect(isDateOnlyInRange('2026-12-01', '2026-11-01', '2026-11-30')).toBe(false);
        expect(isDateOnlyInRange('2026-12-01', '2026-11-01', null)).toBe(true);
        expect(isDateOnlyInRange(null, '2026-11-01', null)).toBe(false);
    });

    it('vencida solo si es antes de hoy', () => {
        const now = new Date(2026, 10, 17, 20, 0, 0);
        expect(isDateOnlyOverdue('2026-11-16', now)).toBe(true);
        expect(isDateOnlyOverdue('2026-11-17', now)).toBe(false);
        expect(isDateOnlyOverdue(null, now)).toBe(false);
    });

    it('el servidor filtra fecha_cierre_estimada con YYYY-MM-DD', () => {
        const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hook).toContain("q.gte('fecha_cierre_estimada', startCloseDay)");
        expect(hook).toContain("q.lte('fecha_cierre_estimada', endCloseDay)");
    });
});
