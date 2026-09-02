import { describe, expect, it } from 'vitest';
import { mapOpportunityReportRow, OpportunityFlattenLookups, mapActivityReportRow, ActivityFlattenLookups } from '@/lib/utils/informes';

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
