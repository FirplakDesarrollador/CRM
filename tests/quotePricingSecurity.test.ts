import { describe, expect, it } from "vitest";
import {
    isManualQuoteItem,
    isQuoteItemPriceEditable,
    sanitizeQuoteItemUpdates
} from "@/lib/quotePricing";

describe("Seguridad de Precios en Ítems de Cotización", () => {
    it("identifica correctamente si un ítem es manual o de catálogo", () => {
        expect(isManualQuoteItem({ producto_id: null })).toBe(true);
        expect(isManualQuoteItem({ producto_id: undefined })).toBe(true);
        expect(isManualQuoteItem({ producto_id: "prod-uuid-1234" })).toBe(false);

        expect(isQuoteItemPriceEditable({ producto_id: null })).toBe(true);
        expect(isQuoteItemPriceEditable({ producto_id: "prod-uuid-1234" })).toBe(false);
    });

    it("bloquea y elimina intentos de modificar manualmente el precio_unitario en productos del catálogo", () => {
        const catalogItem = {
            producto_id: "prod-uuid-1234",
            precio_unitario: 5000000,
            cantidad: 1,
        };

        const maliciousUpdates = {
            precio_unitario: 1000, // Intento de alterar el precio a un valor arbitrario
            cantidad: 2,
        };

        const result = sanitizeQuoteItemUpdates(catalogItem, maliciousUpdates);

        // precio_unitario no debe estar en las actualizaciones permitidas
        expect(result).not.toHaveProperty("precio_unitario");
        // los demás campos válidos se deben conservar
        expect(result.cantidad).toBe(2);
    });

    it("permite modificar el precio_unitario en ítems manuales (producto_id === null)", () => {
        const manualItem = {
            producto_id: null,
            precio_unitario: 0,
            cantidad: 1,
        };

        const validUpdates = {
            precio_unitario: 150000,
            descripcion_linea: "ACCESORIO ESPECIAL A MEDIDA",
        };

        const result = sanitizeQuoteItemUpdates(manualItem, validUpdates);

        expect(result.precio_unitario).toBe(150000);
        expect(result.descripcion_linea).toBe("ACCESORIO ESPECIAL A MEDIDA");
    });

    it("permite cambios de descuento y cantidad en productos del catálogo sin alterar el precio_unitario", () => {
        const catalogItem = {
            producto_id: "prod-uuid-9999",
            precio_unitario: 8000000,
            cantidad: 3,
        };

        const standardUpdates = {
            discount_pct: 12,
            cantidad: 4,
        };

        const result = sanitizeQuoteItemUpdates(catalogItem, standardUpdates);

        expect(result.discount_pct).toBe(12);
        expect(result.cantidad).toBe(4);
        expect(result).not.toHaveProperty("precio_unitario");
    });
});
