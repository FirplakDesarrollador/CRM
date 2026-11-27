import { describe, expect, it } from 'vitest';
import { calculateItemAvailableQty, buildMaxSelectedQuantities } from '../lib/pedidoHelpers';

describe('Cálculo y asignación masiva de cantidades para pedidos', () => {
    describe('calculateItemAvailableQty', () => {
        it('calcula la cantidad disponible descontando lo consumido', () => {
            expect(calculateItemAvailableQty(72, 0)).toBe(72);
            expect(calculateItemAvailableQty(72, 20)).toBe(52);
            expect(calculateItemAvailableQty(72, 72)).toBe(0);
        });

        it('retorna 0 si lo consumido supera la cantidad pactada', () => {
            expect(calculateItemAvailableQty(10, 15)).toBe(0);
        });
    });

    describe('buildMaxSelectedQuantities', () => {
        it('asigna el máximo disponible para cada ítem de cotización', () => {
            const quoteItems = [
                { id: 'item-1', producto_id: 'prod-A', cantidad: 72 },
                { id: 'item-2', producto_id: 'prod-B', cantidad: 61 },
                { id: 'item-3', producto_id: 'prod-C', cantidad: 35 },
                { id: 'item-4', producto_id: null, cantidad: 5 }, // Manual sin producto_id
            ];
            const consumosGlobales = {
                'prod-A': 10,
                'prod-B': 61,
                // prod-C no tiene consumo registrado (0)
            };

            const result = buildMaxSelectedQuantities(quoteItems, consumosGlobales);

            expect(result).toEqual({
                'prod-A': 62,
                'prod-B': 0,
                'prod-C': 35,
            });
        });
    });
});
