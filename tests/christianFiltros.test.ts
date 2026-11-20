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

// Filas con estado_id (sigue en la BD) para comprobar que el filtro lo ignora.
const withEstado = (estado_id: number, fase_id: number | null) => ({ estado_id, fase_id });

describe('Filtro Ganada/Perdida/Abiertas SOLO por fase (estado oculto)', () => {
    it('separa fases cerradas ganadas y perdidas (sin importar mayúsculas)', () => {
        expect(won).toEqual([121, 102]);
        expect(lost).toEqual([122, 103]);
    });

    it('Ganada = fase Cerrada ganada; el estado se ignora', () => {
        expect(matchesStatusFilter(withEstado(1, 121), 'won', won, lost)).toBe(true);
        expect(matchesStatusFilter({ fase_id: '102' }, 'won', won, lost)).toBe(true);
        // estado ganado con fase abierta ya NO cuenta como ganada
        expect(matchesStatusFilter(withEstado(2, 116), 'won', won, lost)).toBe(false);
        expect(matchesStatusFilter(withEstado(11, null), 'won', won, lost)).toBe(false);
    });

    it('Perdida = fase Cerrada perdida', () => {
        expect(matchesStatusFilter({ fase_id: 122 }, 'lost', won, lost)).toBe(true);
        expect(matchesStatusFilter(withEstado(14, 116), 'lost', won, lost)).toBe(false);
        expect(matchesStatusFilter({ fase_id: 121 }, 'lost', won, lost)).toBe(false);
    });

    it('Abiertas = sin fase o fase no cerrada', () => {
        expect(matchesStatusFilter({ fase_id: 116 }, 'open', won, lost)).toBe(true);
        expect(matchesStatusFilter({ fase_id: null }, 'open', won, lost)).toBe(true);
        expect(matchesStatusFilter(withEstado(2, 116), 'open', won, lost)).toBe(true);
        expect(matchesStatusFilter({ fase_id: 121 }, 'open', won, lost)).toBe(false);
        expect(matchesStatusFilter({ fase_id: 122 }, 'open', won, lost)).toBe(false);
        expect(matchesStatusFilter({ fase_id: 116 }, 'all', won, lost)).toBe(true);
    });

    it('arma las condiciones PostgREST del servidor solo con fase_id', () => {
        expect(buildClosedStatusOrCondition('won', won, lost)).toBe('fase_id.in.(121,102)');
        expect(buildClosedStatusOrCondition('lost', won, lost)).toBe('fase_id.in.(122,103)');
        expect(buildClosedStatusOrCondition('won', [], [])).toBe('fase_id.eq.-1');
        expect(buildClosedStatusOrCondition('open', won, lost)).toBeNull();
        expect(buildOpenPhaseOrCondition([...won, ...lost])).toBe('fase_id.is.null,fase_id.not.in.(121,102,122,103)');
        expect(buildOpenPhaseOrCondition([])).toBeNull();
    });

    it('el hook usa estas condiciones en el servidor y en offline, sin estado_id', () => {
        const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hook).toContain('buildClosedStatusOrCondition(statusFilter');
        expect(hook).toContain('buildOpenPhaseOrCondition(closedPhaseIdsRef.current)');
        expect(hook).toContain('matchesStatusFilter(o, statusFilter');
        expect(hook).not.toContain('estado_id');
        expect(hook).not.toContain('CRM_EstadosOportunidad');
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
