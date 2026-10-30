import { describe, expect, it } from "vitest";
import { getProductPrice, getPriceClarification } from "@/lib/salesChannels";

const prices = {
    lista_base_cop: 100,
    lista_base_exportaciones: 200,
    lista_base_obras: 300,
    distribuidor_pvp_iva: 400,
    pvp_sin_iva: 50,
    precio_feria: 500,
};

describe("getProductPrice", () => {
    it.each([
        ["DIST_NAC", 100],
        ["DIST_INT", 200],
        ["OBRAS_NAC", 300],
        ["OBRAS_INT", 200],
        ["PROPIO", 50],
    ])("selecciona la tarifa del canal %s", (channel, expected) => {
        expect(getProductPrice(prices, channel)).toBe(expected);
    });

    it("para PROPIO selecciona pvp_sin_iva en lugar de distribuidor_pvp_iva", () => {
        expect(getProductPrice(prices, "PROPIO")).toBe(50);
    });

    it("hace prevalecer el precio de feria sobre el canal de la cuenta", () => {
        expect(getProductPrice(prices, "DIST_NAC", true)).toBe(500);
    });
});

describe("getPriceClarification", () => {
    it.each([
        ["OBRAS_NAC", "Columna: lista_base_obras (sin IVA)"],
        ["OBRAS_INT", "Columna: lista_base_exportaciones (sin IVA)"],
        ["DIST_NAC", "Columna: lista_base_cop (sin IVA)"],
        ["DIST_INT", "Columna: lista_base_exportaciones (sin IVA)"],
        ["PROPIO", "Columna: pvp_sin_iva (sin IVA)"],
    ])("genera el texto clarificador de columna y estado de IVA para %s", (channel, expected) => {
        expect(getPriceClarification(channel)).toBe(expected);
    });

    it("genera texto para ítem manual", () => {
        expect(getPriceClarification("DIST_NAC", false, true)).toBe("Ítem manual (sin IVA)");
    });

    it("genera texto para cotizaciones en moneda USD (exportación)", () => {
        expect(getPriceClarification("OBRAS_NAC", true, false)).toBe("Columna: lista_base_exportaciones (sin IVA)");
    });

    it("usa fallback de DIST_NAC cuando channelId es undefined o vacío", () => {
        expect(getPriceClarification(undefined)).toBe("Columna: lista_base_cop (sin IVA)");
        expect(getPriceClarification("")).toBe("Columna: lista_base_cop (sin IVA)");
    });
});
