import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Opportunity Fecha de Entrega Field Contract', () => {
    const root = process.cwd();

    it('LocalOportunidad defines fecha_entrega as optional string/null', () => {
        const dbSource = readFileSync(path.join(root, 'lib', 'db.ts'), 'utf8');
        expect(dbSource).toMatch(/fecha_entrega\?:/);
    });

    it('useOpportunities sanitizes fecha_entrega for Postgres DATE type', () => {
        const hookSource = readFileSync(path.join(root, 'lib', 'hooks', 'useOpportunities.ts'), 'utf8');
        expect(hookSource).toMatch(/fecha_entrega:\s*\(updates\.fecha_entrega === "" \? null/);
    });

    it('Opportunity detail page renders and manages fecha_entrega', () => {
        const pageSource = readFileSync(path.join(root, 'app', 'oportunidades', '[id]', 'page.tsx'), 'utf8');
        expect(pageSource).toMatch(/localDeliveryDate/);
        expect(pageSource).toMatch(/Fecha de Entrega/);
        expect(pageSource).toMatch(/updateOpportunity\(opportunity\.id,\s*\{\s*fecha_entrega:/);
    });

    it('Migration file exists adding fecha_entrega column to CRM_Oportunidades', () => {
        const migrationPath = path.join(root, 'supabase', 'migrations', '20261016000000_add_fecha_entrega_to_oportunidades.sql');
        const migrationSource = readFileSync(migrationPath, 'utf8');
        expect(migrationSource).toMatch(/ALTER TABLE public\."CRM_Oportunidades"/i);
        expect(migrationSource).toMatch(/ADD COLUMN IF NOT EXISTS fecha_entrega DATE/i);
    });

    it('Opportunity export in informes includes FECHA ENTREGA column', () => {
        const informesSource = readFileSync(path.join(root, 'app', 'informes', 'page.tsx'), 'utf8');
        expect(informesSource).toMatch(/key:\s*'fecha_entrega'/);
    });

    it('CreateOpportunityWizard supports fecha_entrega field', () => {
        const wizardSource = readFileSync(path.join(root, 'app', 'oportunidades', 'nueva', 'CreateOpportunityWizard.tsx'), 'utf8');
        expect(wizardSource).toMatch(/fecha_entrega:/);
        expect(wizardSource).toMatch(/Fecha de Entrega/);
    });
});

