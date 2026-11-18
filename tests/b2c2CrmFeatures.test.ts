import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveOpportunityCloseDate, toBogotaDateString } from '@/lib/opportunityCloseDate';
import {
    activeColumnKeys,
    loadOpportunityTablePrefs,
    moveColumnStep,
    moveColumnTo,
    normalizeColumnOrder,
    opportunityTablePrefsKey,
    saveOpportunityTablePrefs,
    toggleHiddenColumn,
} from '@/lib/opportunityColumnPrefs';
import {
    parseLeadMinimumAmountConfig,
    resolveLeadMinimumAmount,
    shouldApplyLeadMinimum,
} from '@/lib/leadMinimumAmount';
import { mapOpportunityReportRow } from '@/lib/utils/informes';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (k: string) => (k in data ? data[k] : null),
        setItem: (k: string, v: string) => { data[k] = v; },
    };
}

describe('1. Fecha de cierre (CP / CG) en el reporte', () => {
    const closedAt = Date.UTC(2026, 10, 17, 3, 0, 0); // 16 nov 22:00 en Bogotá

    it('usa la fecha del cambio de fase en hora Colombia (cerrada = por FASE)', () => {
        expect(resolveOpportunityCloseDate({ fase: { nombre: 'Cerrada ganada' }, _sync_metadata: { fase_id: closedAt } })).toBe('2026-11-16');
        expect(resolveOpportunityCloseDate({ fase: [{ nombre: 'Cerrada Perdida' }], _sync_metadata: { estado_id: closedAt } })).toBe('2026-11-16');
    });

    it('si no hay metadata usa fecha_cierre_estimada', () => {
        expect(resolveOpportunityCloseDate({ fase: { nombre: 'Cerrada Perdida' }, fecha_cierre_estimada: '2025-03-04', _sync_metadata: {} })).toBe('2025-03-04');
    });

    it('vacío para oportunidades abiertas', () => {
        expect(resolveOpportunityCloseDate({ fase: { nombre: 'Primer contacto' }, fecha_cierre_estimada: '2026-12-01', _sync_metadata: { fase_id: closedAt } })).toBeNull();
    });

    it('el mapper del reporte trae fecha_cierre', () => {
        const lookups = {
            userMap: new Map(), segmentMap: new Map(), lossReasonMap: new Map(), deptMap: new Map(),
            cityMap: new Map(), canalMap: new Map(), countryMap: new Map(),
        } as Parameters<typeof mapOpportunityReportRow>[1];
        expect(mapOpportunityReportRow({ fase: { nombre: 'Cerrada ganada' }, _sync_metadata: { fase_id: closedAt } }, lookups).fecha_cierre).toBe('2026-11-16');
        expect(mapOpportunityReportRow({ fase: { nombre: 'Visita' } }, lookups).fecha_cierre).toBe('-');
    });

    it('la columna está en Informes > Oportunidades solo para B2C', () => {
        const src = read('app', 'informes', 'page.tsx');
        expect(src).toMatch(/canSeeB2CReportColumns \? \[\{ header: 'FECHA DE CIERRE', key: 'fecha_cierre'/);
        expect(src).toMatch(/userHasB2CAccess\(user\)/);
    });

    it('toBogotaDateString formatea YYYY-MM-DD', () => {
        expect(toBogotaDateString(new Date(Date.UTC(2026, 0, 1, 12)))).toBe('2026-01-01');
    });
});

describe('2. Monto mínimo por categoría para leads', () => {
    const cfg = parseLeadMinimumAmountConfig({
        modo: 'menor',
        montos: {
            'Baños': 232689,
            'Cocinas': 659579,
            'Zona de Labores': 209159,
            'Hidromasajes': 6134369,
            'Accesorios': null,
        },
    });

    it('lee la configuración e ignora montos vacíos', () => {
        expect(cfg.mode).toBe('menor');
        expect(cfg.amounts.get('banos')).toBe(232689);
        expect(cfg.amounts.get('cocinas')).toBe(659579);
        expect(cfg.amounts.get('zona de labores')).toBe(209159);
        expect(cfg.amounts.get('hidromasajes')).toBe(6134369);
        expect(cfg.amounts.has('accesorios')).toBe(false);
    });

    it('reconoce los nombres de WordPress y de la app', () => {
        expect(resolveLeadMinimumAmount('Hidromasajes/Jacuzzis y Tinas', cfg)).toBe(6134369);
        expect(resolveLeadMinimumAmount('baños ', cfg)).toBe(232689);
        expect(resolveLeadMinimumAmount(['Cocinas'], cfg)).toBe(659579);
    });

    it('varias categorías: el menor (configurable a mayor o suma)', () => {
        expect(resolveLeadMinimumAmount('Baños, Cocinas', cfg)).toBe(232689);
        expect(resolveLeadMinimumAmount('Baños, Zona de Labores, Hidromasajes', cfg)).toBe(209159);
        // categorías sin monto no entran en la comparación
        expect(resolveLeadMinimumAmount('Accesorios, Baños', cfg)).toBe(232689);

        const mayor = parseLeadMinimumAmountConfig({ modo: 'mayor', montos: { 'Baños': 100, 'Cocinas': 200 } });
        expect(mayor.mode).toBe('mayor');
        expect(resolveLeadMinimumAmount('Baños, Cocinas', mayor)).toBe(200);

        const maximoAlias = parseLeadMinimumAmountConfig({ modo: 'maximo', montos: { 'Baños': 100, 'Cocinas': 200 } });
        expect(maximoAlias.mode).toBe('mayor');

        const suma = parseLeadMinimumAmountConfig({ modo: 'suma', montos: { 'Baños': 100, 'Cocinas': 200 } });
        expect(resolveLeadMinimumAmount('Baños, Cocinas', suma)).toBe(300);

        const def = parseLeadMinimumAmountConfig({ montos: { 'Baños': 100, 'Cocinas': 200 } });
        expect(def.mode).toBe('menor');
        expect(resolveLeadMinimumAmount('Baños, Cocinas', def)).toBe(100);
    });

    it('la migración trae los montos de Daniela y modo menor', () => {
        const sql = read('supabase', 'migrations', '20261117120000_lead_monto_minimo_por_categoria.sql');
        expect(sql).toMatch(/"modo":\s*"menor"/);
        expect(sql).toMatch(/"Baños":\s*232689/);
        expect(sql).toMatch(/"Cocinas":\s*659579/);
        expect(sql).toMatch(/"Zona de Labores":\s*209159/);
        expect(sql).toMatch(/"Hidromasajes":\s*6134369/);
        expect(sql).toMatch(/"Carpintería de obras":\s*null/);
        expect(sql).toMatch(/"Institucional":\s*null/);
        expect(sql).toMatch(/"Accesorios":\s*null/);
        expect(sql).toMatch(/"Deseo contactar un asesor":\s*null/);
    });

    it('sin configuración o categoría sin monto no cambia nada', () => {
        expect(resolveLeadMinimumAmount('Accesorios', cfg)).toBeNull();
        expect(resolveLeadMinimumAmount('Baños', parseLeadMinimumAmountConfig(null))).toBeNull();
        expect(resolveLeadMinimumAmount(null, cfg)).toBeNull();
    });

    it('solo aplica si el lead llega sin monto', () => {
        expect(shouldApplyLeadMinimum(undefined)).toBe(true);
        expect(shouldApplyLeadMinimum(0)).toBe(true);
        expect(shouldApplyLeadMinimum('')).toBe(true);
        expect(shouldApplyLeadMinimum(150000)).toBe(false);
    });

    it('la edge function y el asistente usan el monto mínimo', () => {
        expect(read('supabase', 'functions', 'wordpress-lead-intake', 'index.ts')).toMatch(/resolveLeadMinimumAmount/);
        expect(read('app', 'oportunidades', 'nueva', 'CreateOpportunityWizard.tsx')).toMatch(/resolveLeadMinimumAmount/);
    });
});

describe('3. Columnas de la home de oportunidades por usuario', () => {
    const defaults = ['nombre', 'cuenta', 'fase', 'valor'];

    it('normaliza el orden guardado y agrega columnas nuevas', () => {
        expect(normalizeColumnOrder(['valor', 'x', 'nombre', 'valor'], defaults)).toEqual(['valor', 'nombre', 'cuenta', 'fase']);
    });

    it('mueve columnas', () => {
        expect(moveColumnStep(defaults, 'fase', -1)).toEqual(['nombre', 'fase', 'cuenta', 'valor']);
        expect(moveColumnStep(defaults, 'nombre', -1)).toEqual(defaults);
        expect(moveColumnTo(defaults, 3, 0)).toEqual(['valor', 'nombre', 'cuenta', 'fase']);
    });

    it('guarda por usuario y no mezcla usuarios', () => {
        const storage = memoryStorage();
        const prefs = toggleHiddenColumn({ order: moveColumnTo(defaults, 3, 0), hidden: [] }, 'cuenta');
        saveOpportunityTablePrefs(storage, 'user-a', prefs);
        expect(Object.keys(storage.data)).toEqual([opportunityTablePrefsKey('user-a')]);
        expect(loadOpportunityTablePrefs(storage, 'user-a', defaults)).toEqual(prefs);
        expect(loadOpportunityTablePrefs(storage, 'user-b', defaults)).toEqual({ order: defaults, hidden: [] });
    });

    it('respeta la lista vieja de columnas visibles', () => {
        const storage = memoryStorage({ crm_opp_visible_cols_v4: JSON.stringify(['nombre', 'valor']) });
        expect(loadOpportunityTablePrefs(storage, 'u', defaults).hidden).toEqual(['cuenta', 'fase']);
    });

    it('columnas activas: orden propio solo si puede reordenar', () => {
        const prefs = { order: ['valor', 'nombre', 'cuenta', 'fase'], hidden: ['cuenta'] };
        expect(activeColumnKeys(prefs, defaults, true)).toEqual(['valor', 'nombre', 'fase']);
        expect(activeColumnKeys(prefs, defaults, false)).toEqual(['nombre', 'fase', 'valor']);
    });

    it('la tabla usa el orden del usuario', () => {
        const src = read('app', 'oportunidades', 'page.tsx');
        expect(src).toMatch(/\.\.\.visibleColumns\s*\n\s*\.map\(key => ALL_COLUMN_DEFS\[key\]\)/);
        expect(src).not.toMatch(/OPPORTUNITY_TABLE_COLUMN_KEYS\.filter\(key => visibleColumns\.includes\(key\)\)/);
    });
});

describe('4. Fecha de creación en la oportunidad (información de la cuenta)', () => {
    it('muestra fecha de creación de la oportunidad y de la cuenta para B2C', () => {
        const src = read('app', 'oportunidades', '[id]', 'page.tsx');
        expect(src).toMatch(/Fecha creación oportunidad/);
        expect(src).toMatch(/formatColombiaDateTime\(opportunity\.created_at/);
        expect(src).toMatch(/userHasB2CAccess\(user\) && \(\s*<div className="grid grid-cols-2 gap-4" data-testid="opp-creation-dates"/);
    });
});
