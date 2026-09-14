import { describe, it, expect } from 'vitest';
import {
    buildOpportunityHotRow,
    resolveHotRowData,
    OPPORTUNITY_TABLE_COLUMN_KEYS,
    OpportunityInput,
    OpportunityHotRow
} from '../lib/opportunityTableHelpers';

describe('Filtros internos de tabla de oportunidades', () => {
    it('debe mapear "actividades" a un string legible y no a un objeto [object Object]', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-1',
            nombre: 'Negocio Venta Grifería',
            amount: 5000000,
            account: {
                nombre: 'Constructora Bolívar',
                ciudad: 'Medellín',
                canal_id: 'OBRAS_NAC',
                pais_id: 1
            },
            actividades: [
                { id: 'act-1', fecha_fin: '2020-01-01', is_completed: false } // Vencida
            ]
        };

        const countryMap: Record<number, string> = { 1: 'Colombia' };
        const hotRow = buildOpportunityHotRow(mockOpp, countryMap);

        // La propiedad 'actividades' DEBE ser un string para que el filtro interno de Handsontable
        // no muestre '[object Object]' y permita buscar por texto ("atrasada", "programada", "sin actividad").
        expect(typeof hotRow.actividades).toBe('string');
        expect(hotRow.actividades).toBe('1 atrasada');
        expect(hotRow.actividades).not.toBe('[object Object]');
        expect(hotRow.actividades_status).toBe('overdue');
    });

    it('debe mapear oportunidad sin actividades a "Sin actividad"', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-2',
            nombre: 'Oportunidad Nueva',
            actividades: []
        };

        const hotRow = buildOpportunityHotRow(mockOpp, {});
        expect(hotRow.actividades).toBe('Sin actividad');
        expect(hotRow.actividades_status).toBe('none');
    });

    it('todas las columnas filtrables deben tener valores primitivos (string/number), nunca objetos ni undefined', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-3',
            nombre: null,
            amount: null,
            account: null,
            actividades: null,
            fase_data: null,
            estado_data: null,
            created_at: null,
            fecha_cierre_estimada: null,
            vendedor: null
        };

        const hotRow = buildOpportunityHotRow(mockOpp, {});

        // Verificar que ninguna columna visible de la tabla sea un objeto ni null
        for (const colKey of OPPORTUNITY_TABLE_COLUMN_KEYS) {
            const value = hotRow[colKey as keyof OpportunityHotRow];
            expect(typeof value).not.toBe('object');
            expect(value).not.toBeNull();
            expect(value).not.toBeUndefined();
        }
    });

    it('debe resolver la fila física correcta cuando la tabla tiene filtros aplicados (toPhysicalRow)', () => {
        const sourceData = [
            { id: 'opp-1', nombre: 'Oportunidad 1' },
            { id: 'opp-2', nombre: 'Oportunidad 2' },
            { id: 'opp-3', nombre: 'Oportunidad 3' }
        ];

        // Simulamos Handsontable cuando se ha filtrado y la fila visual 0 corresponde a la física 2
        const mockHotInstance = {
            toPhysicalRow: (visualRow: number) => {
                if (visualRow === 0) return 2; // La fila visual 0 es la fila 2 de sourceData ('opp-3')
                return -1;
            },
            getSourceDataAtRow: (physicalRow: number) => sourceData[physicalRow]
        };

        const resolvedOpp = resolveHotRowData(mockHotInstance, 0, sourceData);
        expect(resolvedOpp).toBeDefined();
        expect(resolvedOpp!.id).toBe('opp-3');
        expect(resolvedOpp!.nombre).toBe('Oportunidad 3');
    });

    it('OPPORTUNITY_TABLE_COLUMN_KEYS debe incluir "actividades" en la posición exacta', () => {
        expect(OPPORTUNITY_TABLE_COLUMN_KEYS).toContain('actividades');
        expect(OPPORTUNITY_TABLE_COLUMN_KEYS).toEqual([
            'nombre',
            'cuenta',
            'actividades',
            'pais',
            'ciudad',
            'canal',
            'origen',
            'fase',
            'estado',
            'creada',
            'valor',
            'cierre',
            'vendedor'
        ]);
    });
});
