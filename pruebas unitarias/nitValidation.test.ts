import { describe, expect, it } from "vitest";
import {
    generateProvisionalNit,
    isValidRealNit,
    isProvisionalNit,
} from "@/lib/nitUtils";
import {
    getMissingPedidoFormalizationFields,
    PedidoWithItems,
} from "@/lib/pedidoFormalization";

describe("Validación y generación de NITs (Real vs Provisional)", () => {
    it("genera NITs provisionales únicos con prefijo PROV- y caracteres alfanuméricos", () => {
        const nit1 = generateProvisionalNit();
        const nit2 = generateProvisionalNit();

        expect(nit1).toMatch(/^PROV-[A-F0-9]{8}$/);
        expect(nit2).toMatch(/^PROV-[A-F0-9]{8}$/);
        expect(nit1).not.toBe(nit2);
    });

    it("identifica correctamente NITs provisionales", () => {
        expect(isProvisionalNit("PROV-A1B2C3D4")).toBe(true);
        expect(isProvisionalNit("PROV-12345678")).toBe(true);
        expect(isProvisionalNit("890927404-0")).toBe(false);
        expect(isProvisionalNit("900123456")).toBe(false);
        expect(isProvisionalNit(null)).toBe(false);
    });

    it("valida NITs reales numéricos con o sin dígito de verificación", () => {
        expect(isValidRealNit("890927404-0")).toBe(true);
        expect(isValidRealNit("900123456-1")).toBe(true);
        expect(isValidRealNit("123456789")).toBe(true);
        expect(isValidRealNit("800123456")).toBe(true);
        expect(isValidRealNit(" 890927404-0 ")).toBe(true);

        // Rechaza provisionales, vacíos o cadenas no numéricas
        expect(isValidRealNit("PROV-A1B2C3D4")).toBe(false);
        expect(isValidRealNit("PROV-12345678")).toBe(false);
        expect(isValidRealNit("")).toBe(false);
        expect(isValidRealNit(null)).toBe(false);
        expect(isValidRealNit(undefined)).toBe(false);
        expect(isValidRealNit("Sin NIT")).toBe(false);
        expect(isValidRealNit("ABC-12345")).toBe(false);
    });

    it("bloquea la formalización de pedidos si el NIT del cliente final es provisional o inválido", () => {
        const pedidoConNitProvisional: PedidoWithItems = {
            uuid_generado: "pedido-1",
            cotizacion_id: "quote-1",
            estado_pedido: "PLANEADO",
            cierre_facturacion: false,
            fecha_facturacion: "2026-08-15",
            es_muestra: false,
            servicio_subida_hidromasaje: false,
            piso_entrega: 1,
            tiene_escaleras: false,
            verificacion_previa_firplak: false,
            direccion_envio_factura: "Calle 1 # 2-3",
            dir_envio_factura_tipo: "OFICINA",
            cliente_final: "Cliente del pedido",
            nit_cliente_final: "PROV-A1B2C3D4",
            items: [{
                id: "pedido-item-1",
                pedido_uuid: "pedido-1",
                producto_id: "producto-1",
                cantidad: 2,
                precio_unitario: 119_000,
                descuento: 10,
            }],
        };

        const missing = getMissingPedidoFormalizationFields(pedidoConNitProvisional);
        expect(missing).toContain("NIT real del cliente (formato numérico requerido para facturación)");
    });

    it("permite la formalización de pedidos cuando el NIT del cliente final es real", () => {
        const pedidoConNitReal: PedidoWithItems = {
            uuid_generado: "pedido-1",
            cotizacion_id: "quote-1",
            estado_pedido: "PLANEADO",
            cierre_facturacion: false,
            fecha_facturacion: "2026-08-15",
            es_muestra: false,
            servicio_subida_hidromasaje: false,
            piso_entrega: 1,
            tiene_escaleras: false,
            verificacion_previa_firplak: false,
            direccion_envio_factura: "Calle 1 # 2-3",
            dir_envio_factura_tipo: "OFICINA",
            cliente_final: "Cliente del pedido",
            nit_cliente_final: "890927404-0",
            items: [{
                id: "pedido-item-1",
                pedido_uuid: "pedido-1",
                producto_id: "producto-1",
                cantidad: 2,
                precio_unitario: 119_000,
                descuento: 10,
            }],
        };

        const missing = getMissingPedidoFormalizationFields(pedidoConNitReal);
        expect(missing).not.toContain("NIT real del cliente (formato numérico requerido para facturación)");
        expect(missing).toEqual([]);
    });
});
