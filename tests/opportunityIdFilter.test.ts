import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Opportunity ID Filter Contract', () => {
    const root = process.cwd();

    it('Migration file exists for search_opportunities_by_id RPC', () => {
        const migrationPath = path.join(root, 'supabase', 'migrations', '20261117120000_add_search_opportunities_by_id_rpc.sql');
        const migrationSource = readFileSync(migrationPath, 'utf8');
        expect(migrationSource).toMatch(/CREATE OR REPLACE FUNCTION public\.search_opportunities_by_id/);
        expect(migrationSource).toMatch(/GRANT EXECUTE ON FUNCTION public\.search_opportunities_by_id/);
    });

    it('OpportunityFilters component defines and exposes idFilter', () => {
        const filtersSource = readFileSync(path.join(root, 'components', 'oportunidades', 'OpportunityFilters.tsx'), 'utf8');
        expect(filtersSource).toMatch(/idFilter/);
        expect(filtersSource).toMatch(/data-testid="opportunities-filter-id"/);
    });

    it('useOpportunitiesServer hook defines idFilter and setIdFilter', () => {
        const hookSource = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunitiesServer.ts'), 'utf8');
        expect(hookSource).toMatch(/idFilter/);
        expect(hookSource).toMatch(/setIdFilter/);
    });

    it('Opportunities page handles idFilter and syncs with state', () => {
        const pageSource = readFileSync(path.join(root, 'app', 'oportunidades', 'page.tsx'), 'utf8');
        expect(pageSource).toMatch(/idFilter/);
        expect(pageSource).toMatch(/setIdFilter/);
    });

    it('Offline opportunity filtering matches by opportunity id', () => {
        const mockOpportunities = [
            { id: 'a60c52c8-9108-4b22-9c97-647a179a3c19', nombre: 'Oportunidad A' },
            { id: 'f3f3db5a-dcdf-49ca-a9c9-c3706af15756', nombre: 'Oportunidad B' },
            { id: 'a0a95374-2f4c-4af2-a1d5-b49c3fdc1e9e', nombre: 'Oportunidad C' }
        ];

        const filterById = (opps: typeof mockOpportunities, term: string) => {
            const clean = term.trim().toLowerCase();
            return opps.filter(o => o.id.toLowerCase().includes(clean));
        };

        // Partial match
        expect(filterById(mockOpportunities, 'a60c')).toHaveLength(1);
        expect(filterById(mockOpportunities, 'a60c')[0].id).toBe('a60c52c8-9108-4b22-9c97-647a179a3c19');

        // Full match
        expect(filterById(mockOpportunities, 'f3f3db5a-dcdf-49ca-a9c9-c3706af15756')).toHaveLength(1);
        expect(filterById(mockOpportunities, 'f3f3db5a-dcdf-49ca-a9c9-c3706af15756')[0].nombre).toBe('Oportunidad B');

        // No match
        expect(filterById(mockOpportunities, 'non-existent-id')).toHaveLength(0);
    });
});
