import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapOpportunityReportRow, OpportunityFlattenLookups } from '@/lib/utils/informes';

describe('Opportunity Setter Field and Report Contract', () => {
    const root = process.cwd();

    it('LocalOportunidad defines setter as optional string/null', () => {
        const dbSource = readFileSync(path.join(root, 'lib', 'db.ts'), 'utf8');
        expect(dbSource).toMatch(/setter\?:\s*'CO'\s*\|\s*'REC'/);
    });

    it('useOpportunities sanitizes setter to null when empty', () => {
        const hookSource = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunities.ts'), 'utf8');
        expect(hookSource).toMatch(/setter:\s*updates\.setter !== undefined \? \(updates\.setter \|\| null\) : undefined/);
    });

    it('Opportunity detail page renders Setter Card with CO and REC options', () => {
        const pageSource = readFileSync(path.join(root, 'app', 'oportunidades', '[id]', 'page.tsx'), 'utf8');
        expect(pageSource).toMatch(/localSetter/);
        expect(pageSource).toMatch(/handleSetterChange/);
        expect(pageSource).toMatch(/>\s*CO\s*</);
        expect(pageSource).toMatch(/>\s*REC\s*</);
        expect(pageSource).toMatch(/Ninguna/);
    });

    it('Migration file exists adding setter column to CRM_Oportunidades with audit logging', () => {
        const migrationPath = path.join(root, 'supabase', 'migrations', '20261023110000_add_setter_to_oportunidades.sql');
        const migrationSource = readFileSync(migrationPath, 'utf8');
        expect(migrationSource).toMatch(/ALTER TABLE public\."CRM_Oportunidades"/i);
        expect(migrationSource).toMatch(/ADD COLUMN IF NOT EXISTS "setter" TEXT NULL/i);
        expect(migrationSource).toMatch(/OLD\.setter IS DISTINCT FROM NEW\.setter/i);
    });

    it('Opportunity export in informes includes SETTER column', () => {
        const informesSource = readFileSync(path.join(root, 'app', 'informes', 'page.tsx'), 'utf8');
        expect(informesSource).toMatch(/key:\s*'setter'/);
        expect(informesSource).toMatch(/header:\s*'SETTER'/);
    });

    it('mapOpportunityReportRow correctly maps setter value or defaults to dash', () => {
        const mockLookups: OpportunityFlattenLookups = {
            userMap: new Map(),
            segmentMap: new Map(),
            lossReasonMap: new Map(),
            deptMap: new Map(),
            cityMap: new Map(),
            canalMap: new Map(),
            countryMap: new Map()
        };

        const itemWithSetterCO = {
            id: 'opp-1',
            nombre: 'Oportunidad con Setter CO',
            setter: 'CO'
        };
        const mappedCO = mapOpportunityReportRow(itemWithSetterCO, mockLookups);
        expect(mappedCO.setter).toBe('CO');

        const itemWithSetterREC = {
            id: 'opp-2',
            nombre: 'Oportunidad con Setter REC',
            setter: 'REC'
        };
        const mappedREC = mapOpportunityReportRow(itemWithSetterREC, mockLookups);
        expect(mappedREC.setter).toBe('REC');

        const itemWithoutSetter = {
            id: 'opp-3',
            nombre: 'Oportunidad sin Setter',
            setter: null
        };
        const mappedNone = mapOpportunityReportRow(itemWithoutSetter, mockLookups);
        expect(mappedNone.setter).toBe('-');
    });
});
