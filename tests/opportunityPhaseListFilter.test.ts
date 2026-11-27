import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDateOnlyDMY } from '@/lib/dateFilterHelpers';
import { mapOpportunityReportRow, type OpportunityFlattenLookups } from '@/lib/utils/informes';
import { buildMiInformeSheets, type MiInformeLookups } from '@/lib/informes/miInforme';
import {
    buildPhaseFilterOptions,
    normalizePhaseFilterValue,
    opportunityMatchesPhaseIds,
    readPersistedPhaseIds,
    resolvePhaseIdQuery,
    serializePhaseIds,
    withoutOpportunityStatusParam,
} from '@/lib/opportunityPhaseListFilter';

const root = process.cwd();

const catalog = [
    { id: 56, nombre: 'Visita', canal_id: 'OBRAS_NAC', orden: 1, is_active: true },
    { id: 97, nombre: 'Visita', canal_id: 'OBRAS_NAC', orden: 1, is_active: false },
    { id: 57, nombre: 'Presentación de propuesta', canal_id: 'OBRAS_NAC', orden: 2, is_active: true },
    { id: 61, nombre: 'Cerrada Ganada', canal_id: 'OBRAS_NAC', orden: 6, is_active: true },
    { id: 82, nombre: 'Primer contacto', canal_id: 'PROPIO', orden: 1, is_active: true },
    { id: 87, nombre: 'Cerrada ganada', canal_id: 'PROPIO', orden: 6, is_active: true },
];

describe('Filtro de fases del listado (reemplaza el de estado)', () => {
    it('arma las fases activas del catálogo y distingue el mismo nombre en otro canal', () => {
        const all = buildPhaseFilterOptions(catalog, null, { OBRAS_NAC: 'Obras Nacional', PROPIO: 'Propio' });
        expect(all[0]).toMatchObject({ id: -1, label: 'Prospecto (Sin fase)' });
        expect(all.map((option) => option.label)).toEqual([
            'Prospecto (Sin fase)',
            'Visita',
            'Presentación de propuesta',
            'Cerrada Ganada (Obras Nacional)',
            'Primer contacto',
            'Cerrada ganada (Propio)',
        ]);
        expect(all.some((option) => option.id === 97)).toBe(false);

        const obras = buildPhaseFilterOptions(catalog, 'OBRAS_NAC');
        expect(obras.map((option) => option.nombre)).toEqual([
            'Prospecto (Sin fase)',
            'Visita',
            'Presentación de propuesta',
            'Cerrada Ganada',
        ]);
    });

    it('selección vacía es Todas; varios ids se guardan y el id viejo de la misma etapa también entra', () => {
        expect(normalizePhaseFilterValue(null)).toEqual([]);
        expect(serializePhaseIds([])).toBeNull();
        expect(readPersistedPhaseIds(null, null)).toEqual([]);
        expect(readPersistedPhaseIds('82,61', null)).toEqual([82, 61]);
        expect(readPersistedPhaseIds(null, '56')).toEqual([56]);

        const query = resolvePhaseIdQuery([56, -1], catalog);
        expect(query.includeUnassigned).toBe(true);
        expect(query.faseIds).toEqual(expect.arrayContaining([56, 97]));

        expect(opportunityMatchesPhaseIds(null, [], catalog)).toBe(true);
        expect(opportunityMatchesPhaseIds(97, [56], catalog)).toBe(true);
        expect(opportunityMatchesPhaseIds(82, [56], catalog)).toBe(false);
        expect(opportunityMatchesPhaseIds(null, [56, -1], catalog)).toBe(true);
        expect(opportunityMatchesPhaseIds(61, [-1], catalog)).toBe(false);
    });

    it('la URL y la sesión dejan de arrastrar el filtro de estado', () => {
        expect(withoutOpportunityStatusParam('tab=mine&status=open&phase=56')).toBe('tab=mine&phase=56');
        expect(withoutOpportunityStatusParam('?status=won')).toBe('');

        const page = readFileSync(path.join(root, 'app', 'oportunidades', 'page.tsx'), 'utf8');
        const filters = readFileSync(path.join(root, 'components', 'oportunidades', 'OpportunityFilters.tsx'), 'utf8');
        expect(page).toContain('ignorePersistedStatus: true');
        expect(page).toContain("params.delete('status')");
        expect(page).not.toContain("params.set('status'");
        expect(filters).toContain('data-testid="opportunities-filter-phases"');
        expect(filters).toContain('data-testid="opportunities-filter-phase-all"');
        expect(filters).not.toContain('opportunities-filter-status-');
    });
});

describe('Fecha estimada en el informe de oportunidades', () => {
    const lookups: OpportunityFlattenLookups = {
        userMap: new Map(),
        segmentMap: new Map(),
        lossReasonMap: new Map(),
        deptMap: new Map(),
        cityMap: new Map(),
        canalMap: new Map(),
        countryMap: new Map(),
    };

    it('formatea fecha_cierre_estimada como el resto del CRM (DD/MM/AAAA) y no inventa otra columna', () => {
        expect(formatDateOnlyDMY('2026-03-15')).toBe('15/03/2026');
        const withDate = mapOpportunityReportRow({ fecha_cierre_estimada: '2026-03-15' }, lookups);
        expect(withDate.fecha_estimada).toBe('15/03/2026');
        expect(withDate.fecha_cierre_estimada).toBe('2026-03-15');
        const empty = mapOpportunityReportRow({ fecha_cierre_estimada: null }, lookups);
        expect(empty.fecha_estimada).toBe('-');

        const page = readFileSync(path.join(root, 'app', 'informes', 'page.tsx'), 'utf8');
        expect(page).toContain("{ header: 'FECHA ESTIMADA', key: 'fecha_estimada', width: 18 }");
        expect(page).not.toContain("header: 'FECHA CIERRE EST.'");
    });

    it('Mi informe exporta la misma fecha con el mismo formato', () => {
        const miLookups: MiInformeLookups = {
            canales: new Map(),
            fases: new Map(),
            segmentos: new Map(),
            departamentos: new Map(),
            ciudades: new Map(),
            tiposActividad: new Map(),
            clasificaciones: new Map(),
            subclasificaciones: new Map(),
            cuentas: new Map(),
            oportunidades: new Map(),
        };
        const sheets = buildMiInformeSheets({
            cuentas: [],
            contactos: [],
            oportunidades: [{ id: 'opp-1', nombre: 'Torre', fecha_cierre_estimada: '2026-11-01' }],
            actividades: [],
        }, miLookups);
        const oportunidades = sheets.find((sheet) => sheet.name === 'Oportunidades');
        expect(oportunidades?.columns.some((column) => column.header === 'FECHA ESTIMADA' && column.key === 'fecha_cierre_estimada')).toBe(true);
        expect(oportunidades?.rows[0].fecha_cierre_estimada).toBe('01/11/2026');
    });
});
