import { describe, it, expect } from 'vitest';
import {
    filterOpportunitiesByProduct,
    OpportunityWithProducts,
    getOpportunityIdsByProductFilters
} from '@/lib/opportunityProductFilterHelpers';

describe('Filtros de Planta y Familia en Oportunidades', () => {
    const mockOpportunities: OpportunityWithProducts[] = [
        {
            id: 'opp-1',
            nombre: 'Proyecto Torres del Parque',
            amount: 50000000,
            quoteItems: [
                { producto_id: 'prod-1', planta: 'FVHMP', familia: 'BAÑERAS' },
                { producto_id: 'prod-2', planta: 'PC', familia: 'LAVAMANOS' }
            ]
        },
        {
            id: 'opp-2',
            nombre: 'Hotel Dann Carlton',
            amount: 25000000,
            quoteItems: [
                { producto_id: 'prod-3', planta: 'MBL', familia: 'MUEBLES' }
            ]
        },
        {
            id: 'opp-3',
            nombre: 'Remodelación Casa Campestre',
            amount: 15000000,
            quoteItems: [
                { producto_id: 'prod-4', planta: 'FVHMP', familia: 'SPAS' }
            ]
        },
        {
            id: 'opp-4',
            nombre: 'Prospección sin cotización',
            amount: 10000000,
            quoteItems: [] // Sin productos cotizados
        }
    ];

    it('debe devolver todas las oportunidades si no hay filtro de planta ni de familia', () => {
        const result = filterOpportunitiesByProduct(mockOpportunities, {
            planta: null,
            familia: null
        });
        expect(result.length).toBe(4);
    });

    it('debe filtrar oportunidades por Planta correctamente', () => {
        const resultFVHMP = filterOpportunitiesByProduct(mockOpportunities, {
            planta: 'FVHMP',
            familia: null
        });
        // opp-1 y opp-3 tienen productos de FVHMP
        expect(resultFVHMP.map(o => o.id)).toEqual(['opp-1', 'opp-3']);

        const resultMBL = filterOpportunitiesByProduct(mockOpportunities, {
            planta: 'MBL',
            familia: null
        });
        expect(resultMBL.map(o => o.id)).toEqual(['opp-2']);
    });

    it('debe filtrar oportunidades por Familia correctamente', () => {
        const result = filterOpportunitiesByProduct(mockOpportunities, {
            planta: null,
            familia: 'LAVAMANOS'
        });
        // opp-1 tiene LAVAMANOS
        expect(result.map(o => o.id)).toEqual(['opp-1']);
    });

    it('debe filtrar por coincidencia simultánea de Planta y Familia', () => {
        // FVHMP + BAÑERAS -> solo opp-1
        const result1 = filterOpportunitiesByProduct(mockOpportunities, {
            planta: 'FVHMP',
            familia: 'BAÑERAS'
        });
        expect(result1.map(o => o.id)).toEqual(['opp-1']);

        // FVHMP + MUEBLES -> ninguna (opp-1 tiene FVHMP pero Bañeras/Lavamanos, opp-2 tiene Muebles pero en MBL)
        const result2 = filterOpportunitiesByProduct(mockOpportunities, {
            planta: 'FVHMP',
            familia: 'MUEBLES'
        });
        expect(result2.length).toBe(0);
    });

    it('debe excluir oportunidades sin productos cuando hay un filtro activo', () => {
        const result = filterOpportunitiesByProduct(mockOpportunities, {
            planta: 'PC',
            familia: null
        });
        expect(result.some(o => o.id === 'opp-4')).toBe(false);
    });

    it('getOpportunityIdsByProductFilters debe extraer correctamente los IDs únicos a partir de items de cotizaciones', () => {
        const flatItems = [
            { opportunity_id: 'opp-1', planta: 'PC', familia: 'LAVAMANOS' },
            { opportunity_id: 'opp-1', planta: 'PC', familia: 'LAVAMANOS' }, // duplicado en misma opp
            { opportunity_id: 'opp-2', planta: 'MBL', familia: 'MUEBLES' },
            { opportunity_id: 'opp-3', planta: 'PC', familia: 'BAÑERAS' }
        ];

        const pcOppIds = getOpportunityIdsByProductFilters(flatItems, { planta: 'PC', familia: null });
        expect(pcOppIds).toEqual(['opp-1', 'opp-3']);

        const lavamanosOppIds = getOpportunityIdsByProductFilters(flatItems, { planta: null, familia: 'LAVAMANOS' });
        expect(lavamanosOppIds).toEqual(['opp-1']);
    });
});

