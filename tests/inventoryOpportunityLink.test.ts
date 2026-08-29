import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: null } })),
        },
        from: vi.fn(),
        rpc: vi.fn(),
    },
}));

import {
    enrichMovementsWithOpportunities,
    extractOpportunityIdsFromMovements,
    type InventoryMovement,
} from '@/lib/hooks/useInventory';

describe('Inventory Opportunity Linking', () => {
    const sampleMovements: InventoryMovement[] = [
        {
            id: 'mov-1',
            producto_id: 'prod-100',
            operacion: 'RESERVA',
            cantidad: 5,
            estado: 'ACTIVO',
            referencia_tipo: 'OPORTUNIDAD',
            referencia_id: 'opp-1',
            notas: 'Reserva para proyecto X',
            created_at: '2026-08-28T10:00:00Z',
            updated_at: '2026-08-28T10:00:00Z',
            producto: { numero_articulo: 'ART-01', descripcion: 'Bañera Hidromasaje' },
        },
        {
            id: 'mov-2',
            producto_id: 'prod-100',
            operacion: 'SALIDA',
            cantidad: 2,
            estado: 'ACTIVO',
            referencia_tipo: 'OPORTUNIDAD_FERIA',
            referencia_id: 'opp-2',
            notas: null,
            created_at: '2026-08-28T11:00:00Z',
            updated_at: '2026-08-28T11:00:00Z',
            producto: { numero_articulo: 'ART-01', descripcion: 'Bañera Hidromasaje' },
        },
        {
            id: 'mov-3',
            producto_id: 'prod-200',
            operacion: 'ENTRADA',
            cantidad: 10,
            estado: 'ACTIVO',
            referencia_tipo: null,
            referencia_id: null,
            notas: 'Carga inicial de stock',
            created_at: '2026-08-28T09:00:00Z',
            updated_at: '2026-08-28T09:00:00Z',
            producto: { numero_articulo: 'ART-02', descripcion: 'Lavamanos Sobreponer' },
        },
    ];

    it('extracts unique opportunity IDs from movements with opportunity references', () => {
        const oppIds = extractOpportunityIdsFromMovements(sampleMovements);
        expect(oppIds).toEqual(['opp-1', 'opp-2']);
    });

    it('enriches movements with matching opportunity data and keeps null for unlinked movements', () => {
        const opportunitiesMap = new Map([
            ['opp-1', { id: 'opp-1', nombre: 'Hotel Resort Caribe' }],
            ['opp-2', { id: 'opp-2', nombre: 'Feria Expocamacol 2026' }],
        ]);

        const enriched = enrichMovementsWithOpportunities(sampleMovements, opportunitiesMap);

        expect(enriched).toHaveLength(3);
        expect(enriched[0].oportunidad).toEqual({ id: 'opp-1', nombre: 'Hotel Resort Caribe' });
        expect(enriched[1].oportunidad).toEqual({ id: 'opp-2', nombre: 'Feria Expocamacol 2026' });
        expect(enriched[2].oportunidad).toBeNull();
    });

    it('handles movements referencing non-existent or deleted opportunities gracefully', () => {
        const emptyMap = new Map<string, { id: string; nombre: string }>();
        const enriched = enrichMovementsWithOpportunities(sampleMovements, emptyMap);

        expect(enriched[0].oportunidad).toBeNull();
        expect(enriched[0].referencia_id).toBe('opp-1');
    });
});
