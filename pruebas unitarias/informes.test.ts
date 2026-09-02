import { describe, expect, it } from 'vitest';
import { mapOpportunityReportRow, OpportunityFlattenLookups } from '@/lib/utils/informes';

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
});
