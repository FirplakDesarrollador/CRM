import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(path.join(process.cwd(), 'app', 'actividades', 'page.tsx'), 'utf8');

describe('Activities page: inline filter bar and Desde/Hasta range', () => {
    it('no longer hides filters behind a "Filtros" toggle', () => {
        expect(page).not.toMatch(/setShowFilters/);
        expect(page).not.toMatch(/<span>Filtros<\/span>/);
        expect(page).toMatch(/data-testid="activities-filter-bar"/);
    });

    it('renders the Desde / Hasta inputs unconditionally in the header (not B2C gated)', () => {
        const header = page.slice(page.indexOf('<header'), page.indexOf('</header>'));
        expect(header).toMatch(/data-testid="activities-date-from"/);
        expect(header).toMatch(/data-testid="activities-date-to"/);
        const rangeBlock = header.slice(header.indexOf('activities-date-range'));
        expect(rangeBlock.slice(0, 600)).not.toMatch(/canSeeB2C|userHasB2CAccess/);
    });

    it('range overrides the single-date navigator and the Hasta la fecha / Solo este día toggle in agenda', () => {
        expect(page).toMatch(/view === 'agenda' && dateRangeActive/);
        expect(page).toMatch(/!\(view === 'agenda' && dateRangeActive\)/);
        expect(page).toMatch(/view === 'agenda' && !dateRangeActive/);
        expect(page).toMatch(/view === 'agenda' && !filterDateFrom && !filterDateTo/);
    });

    it('keeps the clear-all button', () => {
        expect(page).toMatch(/title="Limpiar filtros"/);
    });
});
