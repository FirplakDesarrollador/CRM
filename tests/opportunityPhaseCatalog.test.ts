import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const remotePhases = vi.hoisted(() => ({ active: [] as unknown[], labels: [] as unknown[] }));

vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: (table: string) => {
            const builder = {
                select: () => builder,
                eq: (column: string, value: unknown) => {
                    if (table === 'CRM_FasesOportunidad' && column === 'is_active' && value === true) {
                        return Promise.resolve({ data: remotePhases.active, error: null });
                    }
                    return builder;
                },
                then: (
                    resolve: (value: { data: unknown[]; error: null }) => void,
                    reject?: (reason: unknown) => void,
                ) => Promise.resolve({
                    data: table === 'CRM_FasesOportunidad' ? remotePhases.labels : [],
                    error: null,
                }).then(resolve, reject),
            };
            return builder;
        },
    },
}));
import { CRMFirplakDB } from '@/lib/db';
import {
    expandSelectedPhaseIds,
    phaseLabelForId,
    planPhaseCatalogWrite,
    resolveStepperPhaseId,
    selectPhasesForPicker,
} from '@/lib/opportunityPhaseCatalog';
import { getAvailablePhasesForChannel, getEquivalentPhaseIds } from '@/lib/opportunityColumnFilterHelpers';

/**
 * Catálogo PROPIO real: las fases viejas 82-88 comparten orden con las activas 116-122.
 * El stepper que se queda con el id menor pinta 82-88 y deja en gris una ganada en 121.
 */
const PROPIO = [
    { id: 82, nombre: 'Primer contacto', orden: 1, canal_id: 'PROPIO', is_active: false, probability: 10 },
    { id: 83, nombre: 'Presentación de propuesta', orden: 2, canal_id: 'PROPIO', is_active: false, probability: 20 },
    { id: 84, nombre: 'Acuerdo de precios', orden: 3, canal_id: 'PROPIO', is_active: false, probability: 40 },
    { id: 85, nombre: 'Negociación final', orden: 4, canal_id: 'PROPIO', is_active: false, probability: 50 },
    { id: 86, nombre: 'Esperando pedido', orden: 5, canal_id: 'PROPIO', is_active: false, probability: 60 },
    { id: 87, nombre: 'Cerrada ganada', orden: 6, canal_id: 'PROPIO', is_active: false, probability: 100 },
    { id: 88, nombre: 'Cerrada Perdida', orden: 7, canal_id: 'PROPIO', is_active: false, probability: 0 },
    { id: 116, nombre: 'Primer contacto', orden: 1, canal_id: 'PROPIO', is_active: true, probability: 10 },
    { id: 117, nombre: 'Presentación de propuesta', orden: 2, canal_id: 'PROPIO', is_active: true, probability: 20 },
    { id: 118, nombre: 'Acuerdo de precios', orden: 3, canal_id: 'PROPIO', is_active: true, probability: 40 },
    { id: 119, nombre: 'Negociación final', orden: 4, canal_id: 'PROPIO', is_active: true, probability: 50 },
    { id: 120, nombre: 'Esperando pedido', orden: 5, canal_id: 'PROPIO', is_active: true, probability: 60 },
    { id: 121, nombre: 'Cerrada ganada', orden: 6, canal_id: 'PROPIO', is_active: true, probability: 100 },
    { id: 122, nombre: 'Cerrada Perdida', orden: 7, canal_id: 'PROPIO', is_active: true, probability: 0 },
];

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), 'utf8');

describe('Fases activas para el stepper y los selectores', () => {
    it('descarta inactivas antes de deduplicar por orden y se queda con la activa', () => {
        const picked = selectPhasesForPicker(PROPIO, 'PROPIO');
        expect(picked.map(phase => phase.id)).toEqual([116, 117, 118, 119, 120, 121, 122]);
        expect(picked.some(phase => phase.is_active === false)).toBe(false);
    });

    it('si dos activas comparten orden, conserva el id menor', () => {
        const picked = selectPhasesForPicker([
            { id: 200, nombre: 'Visita', orden: 1, canal_id: 'OBRAS_NAC', is_active: true },
            { id: 97, nombre: 'Visita', orden: 1, canal_id: 'OBRAS_NAC', is_active: true },
        ], 'OBRAS_NAC');
        expect(picked.map(phase => phase.id)).toEqual([97]);
    });

    it('una inactiva con id menor no gana a la activa del mismo orden', () => {
        const picked = selectPhasesForPicker([
            { id: 56, nombre: 'Visita', orden: 1, canal_id: 'OBRAS_NAC', is_active: false },
            { id: 97, nombre: 'Visita', orden: 1, canal_id: 'OBRAS_NAC', is_active: true },
        ], 'OBRAS_NAC');
        expect(picked.map(phase => phase.id)).toEqual([97]);
    });

    it('resalta la fase activa del mismo canal y orden cuando la oportunidad sigue en un id inactivo', () => {
        expect(resolveStepperPhaseId(121, PROPIO, 'PROPIO')).toBe(121);
        expect(resolveStepperPhaseId(87, PROPIO, 'PROPIO')).toBe(121);
        expect(resolveStepperPhaseId(82, PROPIO, 'PROPIO')).toBe(116);
        expect(resolveStepperPhaseId(88, PROPIO, 'PROPIO')).toBe(122);
    });

    it('el nombre histórico sale del catálogo completo, incluidas las inactivas', () => {
        expect(phaseLabelForId(87, PROPIO)).toBe('Cerrada ganada');
        expect(phaseLabelForId(121, PROPIO)).toBe('Cerrada ganada');
        expect(phaseLabelForId(82, PROPIO)).toBe('Primer contacto');
        expect(phaseLabelForId(null, PROPIO)).toBe('Prospecto');
    });

    it('elegir la fase activa también alcanza los ids viejos del mismo orden', () => {
        expect(expandSelectedPhaseIds([121], PROPIO)).toEqual(expect.arrayContaining([121, 87]));
        expect(getEquivalentPhaseIds(PROPIO, 121)).toEqual(expect.arrayContaining([121, 87]));
    });

    it('el filtro por canal ofrece solo fases activas, incluidas las cerradas', () => {
        const propio = getAvailablePhasesForChannel(PROPIO, 'PROPIO');
        expect(propio.map(phase => phase.id)).toEqual([116, 117, 118, 119, 120, 121, 122]);
        expect(getAvailablePhasesForChannel(PROPIO, null)).toEqual([]);
    });

    it('la hidratación guarda solo activas y conserva las inactivas para las etiquetas', () => {
        const plan = planPhaseCatalogWrite(PROPIO, PROPIO.filter(phase => phase.is_active), PROPIO);
        expect(plan.phasesToStore.map(phase => phase.id)).toEqual([116, 117, 118, 119, 120, 121, 122]);
        expect(plan.phaseIdsToDelete).toEqual(expect.arrayContaining([82, 83, 84, 85, 86, 87, 88]));
        expect(plan.phaseIdsToDelete).not.toEqual(expect.arrayContaining([121]));
        expect(plan.labels.find(phase => phase.id === 87)?.nombre).toBe('Cerrada ganada');
        expect(plan.labels.find(phase => phase.id === 121)?.is_active).not.toBe(false);
    });

    it('si el servidor no devuelve fases activas, solo borra las inactivas locales', () => {
        const plan = planPhaseCatalogWrite(PROPIO, [], PROPIO);
        expect(plan.phasesToStore).toEqual([]);
        expect(plan.phaseIdsToDelete).toEqual([82, 83, 84, 85, 86, 87, 88]);
        expect(plan.labels.find(phase => phase.id === 87)).toBeDefined();
        expect(plan.labels.find(phase => phase.id === 121)).toBeDefined();
    });
});

describe('Las pantallas que escriben fase_id no vuelven a ofrecer ids inactivos', () => {
    it('la hidratación filtra is_active y limpia Dexie', () => {
        const source = read('lib', 'supabaseDirect.ts');
        const hydration = source.slice(source.indexOf('export async function hydrateReferenceCatalogsFromSupabase'));
        expect(hydration).toContain(".from('CRM_FasesOportunidad')");
        expect(hydration).toContain(".eq('is_active', true)");
        expect(hydration).toContain('planPhaseCatalogWrite');
        expect(hydration).toContain('phaseLabels');
        expect(hydration).toContain('bulkDelete');
    });

    it('el stepper resuelve la fase activa equivalente y no se queda con el id menor', () => {
        const page = read('app', 'oportunidades', '[id]', 'page.tsx');
        expect(page).toContain('selectPhasesForPicker');
        expect(page).toContain('resolveShownPhaseId');
        expect(page).toContain('phaseLabelForId');
        expect(read('lib', 'opportunityPhaseCatalog.ts')).toContain('function resolveStepperPhaseId');
        expect(page).not.toContain('keeping the entry with the lowest id');
    });

    it('crear, editar y la venta en tienda deduplican fases activas', () => {
        expect(read('app', 'oportunidades', 'nueva', 'CreateOpportunityWizard.tsx')).toContain('selectPhasesForPicker');
        expect(read('components', 'tiendas', 'CreateStoreSaleForm.tsx')).toContain('selectPhasesForPicker');
        expect(read('components', 'opportunities', 'OpportunityQuickView.tsx')).toContain('selectPhasesForPicker');
        expect(read('components', 'opportunities', 'OpportunityQuickView.tsx')).toContain('resolveStepperPhaseId');
    });
});

describe('Dexie se autocura al abrir una base que ya tiene fases inactivas', () => {
    const databaseName = 'CRMFirplakDB::phase-self-heal';

    afterEach(async () => {
        await Dexie.delete(databaseName);
    });

    it('pasa las inactivas al catálogo de etiquetas y las quita de phases', async () => {
        const legacy = new Dexie(databaseName);
        legacy.version(15).stores({
            outbox: 'id, entity_type, status, field_timestamp, field_name, user_id, next_attempt_at, [entity_type+entity_id+field_name]',
            fileQueue: 'id, status',
            syncCursors: 'id, user_id, table_name, updated_at',
            syncRuns: 'id, kind, trigger, status, started_at',
            localContext: 'id, user_id, status',
            accounts: 'id, nit, nit_base, nombre, owner_user_id',
            opportunities: 'id, account_id, owner_user_id',
            contacts: 'id, account_id, email',
            quotes: 'id, opportunity_id, status, es_pedido',
            quoteItems: 'id, cotizacion_id',
            activities: 'id, opportunity_id, account_id, user_id, fecha_inicio, tipo_actividad',
            phases: 'id, canal_id, orden',
            subclasificaciones: 'id, canal_id',
            segments: '++id, subclasificacion_id',
            countries: 'id',
            departments: 'id, pais_id, nombre',
            cities: 'id, departamento_id, nombre',
            activityClassifications: 'id, tipo_actividad',
            activitySubclassifications: 'id, clasificacion_id',
            lossReasons: 'id',
            opportunityCollaborators: 'id, oportunidad_id, usuario_id',
            pedidos: 'uuid_generado, cotizacion_id, opportunity_id',
            pedidoItems: 'id, pedido_uuid',
        });
        await legacy.open();
        await legacy.table('phases').bulkPut(PROPIO);
        legacy.close();

        const upgraded = new CRMFirplakDB(databaseName);
        await upgraded.open();
        const stored = await upgraded.phases.toArray();
        const labels = await upgraded.phaseLabels.toArray();
        upgraded.close();

        expect(stored.map(phase => phase.id).sort((a, b) => a - b)).toEqual([116, 117, 118, 119, 120, 121, 122]);
        expect(stored.every(phase => phase.is_active !== false)).toBe(true);
        expect(labels.find(phase => phase.id === 87)?.nombre).toBe('Cerrada ganada');
        expect(labels.find(phase => phase.id === 121)?.nombre).toBe('Cerrada ganada');
    });
});

describe('hydrateReferenceCatalogsFromSupabase no reescribe fases inactivas', () => {
    afterEach(async () => {
        const { db } = await import('@/lib/db');
        await db.phases.clear();
        if (db.phaseLabels) await db.phaseLabels.clear();
    });

    it('borra de phases los ids inactivos que ya estaban en el navegador', async () => {
        remotePhases.active = PROPIO.filter(phase => phase.is_active);
        remotePhases.labels = PROPIO;
        const { db } = await import('@/lib/db');
        const { hydrateReferenceCatalogsFromSupabase } = await import('@/lib/supabaseDirect');
        await db.open();
        await db.phases.bulkPut(PROPIO);

        await hydrateReferenceCatalogsFromSupabase();

        const stored = await db.phases.toArray();
        expect(stored.map(phase => phase.id).sort((a, b) => a - b)).toEqual([116, 117, 118, 119, 120, 121, 122]);
        expect(await db.phaseLabels.get(87)).toMatchObject({ nombre: 'Cerrada ganada', is_active: false });
    });
});
