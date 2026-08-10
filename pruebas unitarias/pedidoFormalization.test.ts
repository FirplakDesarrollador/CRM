import { describe, expect, it } from "vitest";
import { LocalQuote, LocalQuoteItem } from "@/lib/db";
import {
    buildPedidoDocumentData,
    getMissingPedidoFormalizationFields,
    PedidoWithItems,
} from "@/lib/pedidoFormalization";

const completePedido: PedidoWithItems = {
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
    items: [{
        id: "pedido-item-1",
        pedido_uuid: "pedido-1",
        producto_id: "producto-1",
        cantidad: 2,
        precio_unitario: 119_000,
        descuento: 10,
    }],
};

describe("formalización de cotizaciones desde pedidos", () => {
    it("acepta respuestas booleanas en false como datos diligenciados", () => {
        expect(getMissingPedidoFormalizationFields(completePedido)).toEqual([]);
    });

    it("bloquea pedidos heredados sin los datos obligatorios", () => {
        const incomplete: PedidoWithItems = {
            uuid_generado: "pedido-2",
            cotizacion_id: "quote-1",
            estado_pedido: "PLANEADO",
            items: [],
        };

        expect(getMissingPedidoFormalizationFields(incomplete)).toEqual(expect.arrayContaining([
            "Cierre de Facturación",
            "Fecha de Facturación",
            "Opción de Ascensor o Escalera",
            "Dirección Envío Factura",
            "Productos y cantidades del pedido",
        ]));
    });

    it("usa los datos, cantidades y total del pedido seleccionado", () => {
        const quote: LocalQuote = {
            id: "quote-1",
            opportunity_id: "opp-1",
            numero_cotizacion: "COT-100",
            total_amount: 999_999,
            currency_id: "COP",
            status: "DRAFT",
            cliente_final: "Cliente anterior",
        };
        const quoteItems: LocalQuoteItem[] = [{
            id: "quote-item-1",
            cotizacion_id: "quote-1",
            producto_id: "producto-1",
            cantidad: 10,
            precio_unitario: 119_000,
            subtotal: 1_190_000,
            descripcion_linea: "Producto de prueba",
        }];

        const result = buildPedidoDocumentData(quote, completePedido, quoteItems, {
            "producto-1": "SAP-001",
        });

        expect(result.quote.cliente_final).toBe("Cliente del pedido");
        expect(result.quote.total_amount).toBe(214_200);
        expect(result.items).toEqual([expect.objectContaining({
            cantidad: 2,
            discount_pct: 10,
            subtotal: 214_200,
            numero_articulo: "SAP-001",
        })]);
    });
});
