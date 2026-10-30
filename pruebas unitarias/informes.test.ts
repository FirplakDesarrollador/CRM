import { describe, expect, it } from 'vitest';
import { mapOpportunityReportRow, OpportunityFlattenLookups, mapActivityReportRow, ActivityFlattenLookups, fetchAllInChunks } from '@/lib/utils/informes';

describe('Exportación de Oportunidades a Excel', () => {
    const mockLookups: OpportunityFlattenLookups = {
        userMap: new Map([['u1', 'Juan Pérez']]),
        segmentMap: new Map([[1, 'Construcción']]),
        lossReasonMap: new Map([[1, 'Precio alto']]),
        deptMap: new Map([[1, 'Antioquia']]),
        cityMap: new Map([[1, 'Medellín']]),
        canalMap: new Map([['C1', 'Canal Tradicional']]),
        countryMap: new Map([
            [1, 'Colombia'],
            [2, 'Panamá'],
            [3, 'Estados Unidos']
        ])
    };

    it('incluye el campo pais_nombre obtenido desde la cuenta vinculada', () => {
        const item = {
            id: 'opp-1',
            nombre: 'Proyecto Edificio Torre Alta',
            amount: 50000000,
            cuenta: {
                nombre: 'Constructora Bolívar',
                canal_id: 'C1',
                pais_id: 1
            },
            fase: {
                nombre: 'Negociación',
                canal_id: 'C1'
            },
            estado_info: {
                nombre: 'Abierta'
            },
            owner_user_id: 'u1',
            created_by: 'u1',
            segmento_id: 1,
            departamento_id: 1,
            ciudad_id: 1,
            probabilidad: 80
        };

        const result = mapOpportunityReportRow(item, mockLookups);

        expect(result.pais_nombre).toBe('Colombia');
        expect(result.cuenta_nombre).toBe('Constructora Bolívar');
    });

    it('maneja cuentas internacionales asignando correctamente su país correspondiente', () => {
        const item = {
            id: 'opp-2',
            nombre: 'Distribución Panamá',
            cuenta: [{
                nombre: 'Distribuidora del Pacífico',
                canal_id: 'C1',
                pais_id: 2
            }],
            fase: null,
            estado_info: null
        };

        const result = mapOpportunityReportRow(item, mockLookups);

        expect(result.pais_nombre).toBe('Panamá');
        expect(result.cuenta_nombre).toBe('Distribuidora del Pacífico');
    });

    it('devuelve "-" si la cuenta no tiene país o no tiene cuenta vinculada', () => {
        const item = {
            id: 'opp-3',
            nombre: 'Oportunidad sin país',
            cuenta: null
        };

        const result = mapOpportunityReportRow(item, mockLookups);

        expect(result.pais_nombre).toBe('-');
    });

    it('incluye categorias_interes formateadas o "-" si no existen', () => {
        const itemWithCats = {
            id: 'opp-4',
            nombre: 'Oportunidad con Categorias',
            categoria_oportunidad: ['Baños', 'Cocinas'],
            cuenta: { nombre: 'Cliente Uno' }
        };
        const resultWithCats = mapOpportunityReportRow(itemWithCats, mockLookups);
        expect(resultWithCats.categorias_interes).toBe('Baños, Cocinas');

        const itemWithoutCats = {
            id: 'opp-5',
            nombre: 'Oportunidad sin Categorias',
            categoria_oportunidad: null,
            cuenta: { nombre: 'Cliente Dos' }
        };
        const resultWithoutCats = mapOpportunityReportRow(itemWithoutCats, mockLookups);
        expect(resultWithoutCats.categorias_interes).toBe('-');
    });

    it('incluye fecha_actividad y estado_actividad cuando tiene actividad pendiente', () => {
        const item = {
            id: 'opp-act-1',
            nombre: 'Oportunidad con Actividad Pendiente',
            actividades: [
                {
                    id: 'act-1',
                    fecha_fin: '2026-10-27T13:26:00-05:00',
                    is_completed: false,
                    is_deleted: false
                }
            ]
        };
        const result = mapOpportunityReportRow(item, mockLookups);
        expect(result.fecha_actividad).toBe('27/10/2026 13:26');
        expect(result.estado_actividad).toBe('Pendiente');
    });

    it('prioriza la actividad pendiente más próxima frente a completadas o lejanas', () => {
        const item = {
            id: 'opp-act-2',
            nombre: 'Oportunidad con Múltiples Actividades',
            actividades: [
                {
                    id: 'act-past-completed',
                    fecha_fin: '2026-10-01T10:00:00-05:00',
                    is_completed: true,
                    is_deleted: false
                },
                {
                    id: 'act-next-pending',
                    fecha_fin: '2026-10-27T13:26:00-05:00',
                    is_completed: false,
                    is_deleted: false
                },
                {
                    id: 'act-later-pending',
                    fecha_fin: '2026-11-15T09:00:00-05:00',
                    is_completed: false,
                    is_deleted: false
                }
            ]
        };
        const result = mapOpportunityReportRow(item, mockLookups);
        expect(result.fecha_actividad).toBe('27/10/2026 13:26');
        expect(result.estado_actividad).toBe('Pendiente');
    });

    it('muestra la actividad completada más reciente si todas están completadas', () => {
        const item = {
            id: 'opp-act-3',
            nombre: 'Oportunidad con Solo Completadas',
            actividades: [
                {
                    id: 'act-old-completed',
                    fecha_fin: '2026-09-10T10:00:00-05:00',
                    is_completed: true,
                    is_deleted: false
                },
                {
                    id: 'act-latest-completed',
                    fecha_fin: '2026-10-20T16:00:00-05:00',
                    is_completed: true,
                    is_deleted: false
                }
            ]
        };
        const result = mapOpportunityReportRow(item, mockLookups);
        expect(result.fecha_actividad).toBe('20/10/2026 16:00');
        expect(result.estado_actividad).toBe('Completada');
    });

    it('devuelve "-" en fecha_actividad y estado_actividad si no tiene actividades o están borradas', () => {
        const itemWithoutActs = {
            id: 'opp-act-4',
            nombre: 'Oportunidad Sin Actividades',
            actividades: []
        };
        const result1 = mapOpportunityReportRow(itemWithoutActs, mockLookups);
        expect(result1.fecha_actividad).toBe('-');
        expect(result1.estado_actividad).toBe('-');

        const itemWithDeleted = {
            id: 'opp-act-5',
            nombre: 'Oportunidad Borrada',
            actividades: [
                {
                    id: 'act-del',
                    fecha_fin: '2026-10-27T13:26:00-05:00',
                    is_completed: false,
                    is_deleted: true
                }
            ]
        };
        const result2 = mapOpportunityReportRow(itemWithDeleted, mockLookups);
        expect(result2.fecha_actividad).toBe('-');
        expect(result2.estado_actividad).toBe('-');
    });
});

describe('Exportación de Actividades a Excel', () => {
    const mockActivityLookups: ActivityFlattenLookups = {
        userMap: new Map([['u1', 'Juan Pérez']]),
        clasificacionMap: new Map([[10, 'Comercial']]),
        subclasificacionMap: new Map([[100, 'Visita']]),
        tipoActividadMap: new Map([[1, 'Reunión Presencial']])
    };

    it('extrae cuenta directa si existe en la actividad', () => {
        const item = {
            id: 'act-1',
            asunto: 'Reunión Inicial',
            cuenta: { nombre: 'Constructora Bolívar' },
            oportunidad: { nombre: 'Torre 1', amount: 1000000 },
            usuario: { full_name: 'Juan Pérez' }
        };

        const result = mapActivityReportRow(item, mockActivityLookups);
        expect(result.cuenta_nombre).toBe('Constructora Bolívar');
        expect(result.oportunidad_nombre).toBe('Torre 1');
    });

    it('usa la cuenta de la oportunidad como fallback si la actividad no tiene cuenta directa', () => {
        const item = {
            id: 'act-2',
            asunto: 'Llamada de seguimiento',
            cuenta: null,
            oportunidad: {
                nombre: 'Torre 2',
                amount: 2500000,
                cuenta: { nombre: 'Inversiones ABC' }
            },
            usuario: { full_name: 'Juan Pérez' }
        };

        const result = mapActivityReportRow(item, mockActivityLookups);
        expect(result.cuenta_nombre).toBe('Inversiones ABC');
        expect(result.oportunidad_nombre).toBe('Torre 2');
    });
});

describe('Descarga por lotes con fetchAllInChunks', () => {
    it('concatena múltiples lotes y reporta progreso acumulado', async () => {
        const fakeDb = Array.from({ length: 6500 }, (_, i) => ({ id: `row-${i + 1}` }));
        const rangesCalled: [number, number][] = [];
        const progressValues: number[] = [];

        const mockQuery = {
            range: async (from: number, to: number) => {
                rangesCalled.push([from, to]);
                const slice = fakeDb.slice(from, to + 1);
                return { data: slice, error: null };
            }
        };

        const result = await fetchAllInChunks(mockQuery, 2500, (total) => {
            progressValues.push(total);
        });

        expect(result.length).toBe(6500);
        expect(result[0].id).toBe('row-1');
        expect(result[6499].id).toBe('row-6500');
        expect(rangesCalled).toEqual([
            [0, 2499],
            [2500, 4999],
            [5000, 7499]
        ]);
        expect(progressValues).toEqual([2500, 5000, 6500]);
    });

    it('maneja consultas sin datos retornando arreglo vacío sin error', async () => {
        const mockQuery = {
            range: async () => ({ data: [], error: null })
        };
        const result = await fetchAllInChunks(mockQuery, 2500);
        expect(result).toEqual([]);
    });

    it('propaga errores de Supabase si falla un lote', async () => {
        const mockQuery = {
            range: async () => ({ data: null, error: new Error('PostgREST error 57014') })
        };
        await expect(fetchAllInChunks(mockQuery, 2500)).rejects.toThrow('PostgREST error 57014');
    });
});
