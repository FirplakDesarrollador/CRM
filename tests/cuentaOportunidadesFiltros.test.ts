import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('-isazaale.')) acc.push(full);
    }
    return acc;
}

function opportunityServerCalls(source: string): string[] {
    const calls: string[] = [];
    const needle = 'useOpportunitiesServer(';
    let from = 0;
    while (from < source.length) {
        const start = source.indexOf(needle, from);
        if (start < 0) break;
        const open = source.indexOf('{', start);
        if (open < 0) break;
        let depth = 0;
        let end = open;
        for (; end < source.length; end++) {
            if (source[end] === '{') depth += 1;
            else if (source[end] === '}') {
                depth -= 1;
                if (depth === 0) {
                    end += 1;
                    break;
                }
            }
        }
        calls.push(source.slice(open, end));
        from = end;
    }
    return calls;
}

/** Año y mes de un 'YYYY-MM-DD' leídos del texto. El mes es índice 0-11, como Date#getMonth. */
function calendarMonthFromDateOnly(fecha: string): { year: number; monthIndex: number } {
    const [y, m] = String(fecha).slice(0, 10).split('-').map(Number);
    return { year: y, monthIndex: m - 1 };
}

/** Lo que hacía `new Date('YYYY-MM-DD').getMonth()` en un huso al oeste de UTC. */
function monthFromUtcMidnightShifted(fecha: string, offsetHours: number): { year: number; monthIndex: number } {
    const utc = new Date(`${String(fecha).slice(0, 10)}T00:00:00.000Z`);
    const shifted = new Date(utc.getTime() + offsetHours * 60 * 60 * 1000);
    return { year: shifted.getUTCFullYear(), monthIndex: shifted.getUTCMonth() };
}

describe('Pestaña de oportunidades de la cuenta y filtros embebidos', () => {
    const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
    const tab = readFileSync(path.join(root, 'components', 'cuentas', 'AccountOpportunitiesTab.tsx'), 'utf8');
    const combobox = readFileSync(path.join(root, 'components', 'opportunities', 'OpportunityCombobox.tsx'), 'utf8');

    it('las vistas embebidas ignoran URL y sessionStorage del listado', () => {
        expect(hook).toContain('ignorePersistedFilters = false');
        expect(hook).toMatch(/if \(ignorePersistedFilters\) return null/);
        expect(tab).toContain('ignorePersistedFilters: true');
        expect(combobox).toContain('ignorePersistedFilters: true');
    });

    it('la pestaña de la cuenta no hereda id, planta, ciudad ni fechas del listado', () => {
        const effectStart = tab.indexOf('setAccountIdFilter(accountId)');
        const effectEnd = tab.indexOf('}, [', effectStart);
        const effect = tab.slice(effectStart, effectEnd);
        for (const setter of [
            'setIdFilter(null)',
            'setPlantaFilter(null)',
            'setFamiliaFilter(null)',
            'setCountryFilter(null)',
            'setCityFilter(null)',
            'setSetterFilter(null)',
            'setStartDate(null)',
            'setEndDate(null)',
            'setStartClosingDate(null)',
            'setEndClosingDate(null)',
        ]) {
            expect(effect).toContain(setter);
        }
    });

    it('initialStatus solo reemplaza el defecto open; la URL sigue ganando y los demás callers no lo pasan', () => {
        expect(hook).toContain(
            "(getInitialParam('status') as StatusFilter | null) || (initialStatus as StatusFilter | undefined) || 'open'"
        );

        const callers = walk(root).flatMap((file) => {
            const source = readFileSync(file, 'utf8');
            if (!source.includes('useOpportunitiesServer(') || file.endsWith('useOpportunitiesServer.ts')) return [];
            return opportunityServerCalls(source).map((args) => ({ file: path.relative(root, file), args }));
        });

        const withInitialStatus = callers.filter((call) => /initialStatus\s*:/.test(call.args));
        expect(withInitialStatus.map((call) => call.file)).toEqual(['components/cuentas/AccountOpportunitiesTab.tsx']);
        expect(withInitialStatus[0]?.args).toMatch(/initialStatus:\s*'all'/);

        const without = callers.filter((call) => !/initialStatus\s*:/.test(call.args));
        expect(without.length).toBeGreaterThan(0);
        for (const call of without) {
            expect(call.args).not.toMatch(/initialStatus\s*:/);
        }
    });
});

describe('Ventas ganadas: el día 1 no se corre al mes anterior', () => {
    const tile = readFileSync(path.join(root, 'components', 'indicadores', 'VentasGanadasTile.tsx'), 'utf8');

    it('lee año y mes del texto YYYY-MM-DD en lugar de Date (UTC)', () => {
        expect(tile).toContain("String(opp.fecha_cierre_estimada).slice(0, 10).split('-').map(Number)");
        expect(tile).toContain('y === selectedYear && (m - 1) === selectedMonth');
        expect(tile).not.toContain('new Date(opp.fecha_cierre_estimada)');
    });

    it('el 1 de noviembre sigue en noviembre; en UTC-5 Date lo manda a octubre', () => {
        const fecha = '2026-11-01';
        const selectedYear = 2026;
        const november = 10;
        const parsed = calendarMonthFromDateOnly(fecha);
        expect(parsed.year === selectedYear && parsed.monthIndex === november).toBe(true);

        const bogota = monthFromUtcMidnightShifted(fecha, -5);
        expect(bogota.year === selectedYear && bogota.monthIndex === november).toBe(false);
        expect(bogota.monthIndex).toBe(9);
    });
});
