import { describe, expect, it } from "vitest";
import { calculatePdfItemRow, calculatePdfTotals } from "@/lib/pdfGenerator";

describe("Cálculos de Precios e IVA en PDF", () => {
    it("conserva el precio de lista sin IVA y calcula el total de línea con descuento", () => {
        const item = {
            producto_id: "prod-1",
            numero_articulo: "VHPT01-0005-000-0100",
            descripcion_linea: "HIDROMASAJE HONOLULU DERECHA 180X120 BLANCO",
            precio_unitario: 7904580.5,
            cantidad: 1,
            discount_pct: 10,
            subtotal: 7114122.45,
        };

        const row = calculatePdfItemRow(item);

        expect(row.unitPrice).toBe(7904580.5);
        expect(row.lineTotal).toBe(7114122.45);
        expect(row.discountPct).toBe(10);
        expect(row.referencia).toBe("VHPT01-0005-000-0100");
    });

    it("calcula el IVA (19%) adicionado al final sobre el subtotal para COP", () => {
        const items = [
            {
                producto_id: "prod-1",
                precio_unitario: 7904580.5,
                cantidad: 1,
                discount_pct: 10,
                subtotal: 7114122.45,
            },
        ];
        const quote = {
            currency_id: "COP",
            total_amount: 7114122.45,
        };

        const totals = calculatePdfTotals(items, quote);

        expect(totals.subtotal).toBeCloseTo(7114122.45, 2);
        expect(totals.iva).toBeCloseTo(1351683.2655, 2);
        expect(totals.granTotal).toBeCloseTo(8465805.7155, 2);
    });

    it("no aplica IVA para exportaciones en USD y el gran total coincide con el subtotal", () => {
        const items = [
            {
                producto_id: "prod-exp",
                precio_unitario: 2500,
                cantidad: 2,
                discount_pct: 5,
                subtotal: 4750,
            },
        ];
        const quote = {
            currency_id: "USD",
            total_amount: 4750,
        };

        const totals = calculatePdfTotals(items, quote);

        expect(totals.subtotal).toBe(4750);
        expect(totals.iva).toBe(0);
        expect(totals.granTotal).toBe(4750);
    });

    it("desglosa subtotal bruto sin IVA, descuento en pesos, subtotal neto e IVA", () => {
        const items = [
            {
                producto_id: "prod-1",
                precio_unitario: 5000000,
                cantidad: 2,
                discount_pct: 10,
                subtotal: 9000000,
            },
            {
                producto_id: "prod-2",
                precio_unitario: 1000000,
                cantidad: 1,
                discount_pct: 0,
                subtotal: 1000000,
            },
        ];
        const quote = {
            currency_id: "COP",
        };

        const totals = calculatePdfTotals(items, quote);

        // Subtotal bruto antes de descuento: 5.000.000*2 + 1.000.000*1 = 11.000.000
        expect(totals.subtotalBruto).toBe(11000000);
        // Descuento en pesos: 1.000.000 (10% sobre los 10.000.000)
        expect(totals.descuentoTotal).toBe(1000000);
        // Subtotal neto sin IVA tras descuento: 10.000.000
        expect(totals.subtotal).toBe(10000000);
        // IVA 19% sobre subtotal neto: 1.900.000
        expect(totals.iva).toBe(1900000);
        // Gran total con IVA: 11.900.000
        expect(totals.granTotal).toBe(11900000);
    });
});
