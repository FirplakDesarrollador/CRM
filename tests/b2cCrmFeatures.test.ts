import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { digitsOnly, getPhoneIlikePatterns, isPhoneLikeQuery, matchesSearchTokens } from '@/lib/utils';
import { isB2COnlyActivityClassification, userHasB2CAccess } from '@/lib/b2c';
import { OPPORTUNITY_SETTER_OPTIONS } from '@/lib/opportunitySetter';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('Phone / mobile search helpers', () => {
    it('detects phone-like queries but not names', () => {
        expect(isPhoneLikeQuery('3001234567')).toBe(true);
        expect(isPhoneLikeQuery('+57 300 123 4567')).toBe(true);
        expect(isPhoneLikeQuery('(300) 123-4567')).toBe(true);
        expect(isPhoneLikeQuery('300')).toBe(false);
        expect(isPhoneLikeQuery('Juan 3001')).toBe(false);
        expect(isPhoneLikeQuery('')).toBe(false);
    });

    it('digitsOnly strips separators', () => {
        expect(digitsOnly('+57 (300) 123-4567')).toBe('573001234567');
        expect(digitsOnly(null)).toBe('');
    });

    it('matchesSearchTokens finds a phone regardless of the stored format', () => {
        expect(matchesSearchTokens(['Ana', '+57 300 123 4567'], '3001234567')).toBe(true);
        expect(matchesSearchTokens(['Ana', '300-123-4567'], '300 123 4567')).toBe(true);
        expect(matchesSearchTokens(['Ana', '310 999 0000'], '3001234567')).toBe(false);
        // text search keeps working
        expect(matchesSearchTokens(['Ana Pérez', '3001234567'], 'perez')).toBe(true);
    });

    it('builds ilike patterns tolerant to separators', () => {
        expect(getPhoneIlikePatterns('3001234567')).toContain('%3001234567%');
        expect(getPhoneIlikePatterns('3001234567')).toContain('%3%0%0%1%2%3%4%5%6%7%');
        expect(getPhoneIlikePatterns('maria')).toEqual([]);
    });

    it('server hooks and activities page search by phone', () => {
        expect(read('lib', 'hooks', 'useAccountsServer.ts')).toMatch(/telefono\.ilike/);
        expect(read('lib', 'hooks', 'useContactsServer.ts')).toMatch(/getPhoneIlikePatterns/);
        expect(read('lib', 'hooks', 'useOpportunitiesServer.ts')).toMatch(/phoneAccountIds/);
        expect(read('app', 'actividades', 'page.tsx')).toMatch(/findPhoneMatchesLocal|contactPhonesByAccount/);
    });
});

describe('B2C gating', () => {
    it('only PROPIO users and admins see B2C-only features', () => {
        expect(userHasB2CAccess({ role: 'VENDEDOR', canales: ['PROPIO'] })).toBe(true);
        expect(userHasB2CAccess({ role: 'VENDEDOR', canales: ['DIST_NAC'] })).toBe(false);
        expect(userHasB2CAccess({ role: 'ADMIN', canales: ['DIST_NAC'] })).toBe(true);
        expect(userHasB2CAccess({ role: 'VENDEDOR', canales: null })).toBe(false);
        expect(userHasB2CAccess(null)).toBe(false);
    });

    it('recognizes the B2C-only activity classifications', () => {
        expect(isB2COnlyActivityClassification('SETTER')).toBe(true);
        expect(isB2COnlyActivityClassification('Cliente frecuente')).toBe(true);
        expect(isB2COnlyActivityClassification(' cliente FRECUENTE ')).toBe(true);
        expect(isB2COnlyActivityClassification('Visita')).toBe(false);
    });

    it('migration seeds both classifications for EVENTO and TAREA idempotently', () => {
        const sql = read('supabase', 'migrations', '20261027100000_add_setter_cliente_frecuente_activity_classifications.sql');
        expect(sql).toMatch(/'SETTER', 'EVENTO'/);
        expect(sql).toMatch(/'SETTER', 'TAREA'/);
        expect(sql).toMatch(/'Cliente frecuente', 'EVENTO'/);
        expect(sql).toMatch(/'Cliente frecuente', 'TAREA'/);
        expect(sql).toMatch(/ON CONFLICT \(nombre, tipo_actividad\)/);
    });
});

describe('Opportunity setter options', () => {
    it('keeps CO and REC and is used by the creation wizard', () => {
        expect(OPPORTUNITY_SETTER_OPTIONS.map(o => o.value)).toEqual(['CO', 'REC']);
        expect(read('app', 'oportunidades', 'nueva', 'CreateOpportunityWizard.tsx')).toMatch(/OPPORTUNITY_SETTER_OPTIONS/);
    });
});

describe('Activity follow-up, contact shortcuts and date range', () => {
    it('follow-up prompt is wired in every place where an activity can be completed', () => {
        for (const file of [
            ['app', 'actividades', 'page.tsx'],
            ['app', 'oportunidades', '[id]', 'page.tsx'],
            ['components', 'cuentas', 'AccountActivitiesTab.tsx'],
        ]) {
            const src = read(...file);
            expect(src, file.join('/')).toMatch(/useActivityFollowUp/);
            expect(src, file.join('/')).toMatch(/followUpElement/);
        }
        expect(read('app', 'oportunidades', '[id]', 'page.tsx')).toMatch(/onViewActivity/);
    });

    it('contact shortcuts open the wizard with account and contact prefilled', () => {
        const wizard = read('app', 'oportunidades', 'nueva', 'CreateOpportunityWizard.tsx');
        expect(wizard).toMatch(/searchParams\.get\('contact_id'\)/);
        const opps = read('components', 'contactos', 'ContactOpportunities.tsx');
        expect(opps).toMatch(/account_id=.*contact_id=/);
        expect(read('app', 'contactos', 'page.tsx')).toMatch(/ContactOpportunities/);
        expect(read('components', 'contactos', 'ContactList.tsx')).toMatch(/newOpportunityUrlForContact/);
    });

    it('date range in activities is not capped by the agenda day', () => {
        const page = read('app', 'actividades', 'page.tsx');
        expect(page).toMatch(/view === 'agenda' && !filterDateFrom && !filterDateTo/);
    });
});
