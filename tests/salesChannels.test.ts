import { describe, expect, it } from "vitest";
import { getProductPrice } from "@/lib/salesChannels";

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
        ["PROPIO", 400],
        ["FERIA", 500],
    ])("selecciona la tarifa del canal %s", (channel, expected) => {
        expect(getProductPrice(prices, channel)).toBe(expected);
    });

    it("hace prevalecer el precio de feria sobre el canal de la cuenta", () => {
        expect(getProductPrice(prices, "DIST_NAC", true)).toBe(500);
    });
});

