import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addCalendarDays, bogotaYMD, isDateOnlyInRange, toBogotaEndOfDayISO, toBogotaStartOfDayISO } from '@/lib/dateFilterHelpers';
import { matchesOpportunityListDateRange } from '@/lib/opportunityListDateFilter';

const root = process.cwd();

describe('Rangos de fecha del listado en America/Bogota', () => {
    it('hasta incluye todo el día de Colombia y desde empieza a las 00:00 de Bogotá', () => {
        expect(toBogotaStartOfDayISO('2026-11-26')).toBe('2026-11-26T05:00:00.000Z');
        expect(toBogotaEndOfDayISO('2026-11-26')).toBe('2026-11-27T04:59:59.999Z');
        expect(toBogotaStartOfDayISO('')).toBeNull();

        const lateBogota = '2026-11-26T23:30:00.000-05:00';
        const nextBogotaDay = '2026-11-27T00:30:00.000-05:00';
        expect(matchesOpportunityListDateRange(
            { created_at: lateBogota, fecha_cierre_estimada: null },
            'all',
            null,
            '2026-11-26',
        )).toBe(true);
        expect(matchesOpportunityListDateRange(
            { created_at: nextBogotaDay, fecha_cierre_estimada: null },
            'all',
            null,
            '2026-11-26',
        )).toBe(false);
    });

    it('el cierre del listado sigue siendo solo fecha_cierre_estimada', () => {
        expect(isDateOnlyInRange('2026-11-26', '2026-11-01', '2026-11-30')).toBe(true);
        expect(isDateOnlyInRange('2026-11-30', '2026-11-01', '2026-11-30')).toBe(true);
        expect(isDateOnlyInRange('2026-12-01', '2026-11-01', '2026-11-30')).toBe(false);
        const hook = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hook).toContain("q.gte('fecha_cierre_estimada', startCloseDay)");
        expect(hook).toContain("q.lte('fecha_cierre_estimada', endCloseDay)");
        expect(hook).toContain('toBogotaEndOfDayISO(endDate)');
        const page = readFileSync(path.join(root, 'app', 'oportunidades', 'page.tsx'), 'utf8');
        expect(page).toContain('idleLabel="Fecha de creación"');
        expect(page).toContain('idleLabel="Fecha de cierre"');
        expect(page).toContain("params.set('startClose', startClosingDate)");
        expect(page).toContain("params.set('start', startDate)");
    });

    it('el día calendario de Bogotá no depende de la zona del navegador', () => {
        expect(bogotaYMD(new Date('2026-11-27T02:30:00.000Z'))).toBe('2026-11-26');
        expect(addCalendarDays('2026-11-26', -7)).toBe('2026-11-19');
        const informes = readFileSync(path.join(root, 'app', 'informes', 'page.tsx'), 'utf8');
        expect(informes).toContain('Fecha de cierre');
        expect(informes).toContain("query.gte('fecha_cierre_estimada', closeDateFrom)");
        expect(informes).toContain('toBogotaEndOfDayISO(dateTo)');
    });
});
