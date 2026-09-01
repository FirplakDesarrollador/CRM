import { LocalPedido, LocalPedidoItem, LocalQuote, LocalQuoteItem } from "./db";
import { isValidRealNit } from "./nitUtils";

export type PedidoWithItems = LocalPedido & { items?: LocalPedidoItem[] };

export type PedidoDocumentItem = LocalQuoteItem & {
    numero_articulo?: string;
};

const PEDIDO_DOCUMENT_FIELDS: Array<keyof LocalQuote & keyof LocalPedido> = [
    "fecha_minima_requerida",
    "fecha_facturacion",
    "tipo_facturacion",
    "notas_sap",
    "formas_pago",
    "facturacion_electronica",
    "oc_cot",
    "cierre_facturacion",
    "es_muestra",
    "aplica_contrato",
    "multa_incumplimiento",
    "orden_compra",
    "puerto_embarque",
    "terminos_pago",
    "puerto_destino",
    "via_transporte",
    "flete",
    "incoterm",
    "seguro",
    "cliente_final",
    "email_contacto",
    "contacto_ventas",
    "contacto_logistico",
    "contacto_tesoreria",
    "direccion_envio_factura",
    "dir_envio_factura_tipo",
    "servicio_subida_hidromasaje",
    "piso_entrega",
    "tiene_escaleras",
    "verificacion_previa_firplak",
    "planos_hidromasaje",
    "fecha_entrega",
    "nit_cliente_final",
    "entrega_en_obra",
    "bodega_externa",
    "bodega_firplak",
];

/**
 * Mantiene en un solo lugar la regla que protege la emisión formal de una
 * cotización. Los booleanos deben existir explícitamente: false es una
 * respuesta válida, undefined significa que el pedido heredado está incompleto.
 * Exige obligatoriamente un NIT numérico real del cliente.
 */
export function getMissingPedidoFormalizationFields(pedido: PedidoWithItems): string[] {
    const missing: string[] = [];

    if (typeof pedido.cierre_facturacion !== "boolean") missing.push("Cierre de Facturación");
    if (!pedido.fecha_facturacion) missing.push("Fecha de Facturación");
    if (typeof pedido.es_muestra !== "boolean") missing.push("¿Es una Muestra?");
    if (typeof pedido.servicio_subida_hidromasaje !== "boolean") missing.push("Servicio de Subida de Hidromasaje");
    if (!pedido.piso_entrega || Number(pedido.piso_entrega) < 1) missing.push("Piso de Entrega (mínimo 1)");
    if (typeof pedido.tiene_escaleras !== "boolean") missing.push("Opción de Ascensor o Escalera");
    if (typeof pedido.verificacion_previa_firplak !== "boolean") missing.push("Verificación Previa Firplak");
    if (!pedido.direccion_envio_factura?.trim()) missing.push("Dirección Envío Factura");
    if (!pedido.dir_envio_factura_tipo) missing.push("Tipo Dirección Factura (Oficina / Tienda)");
    if (!pedido.nit_cliente_final || !isValidRealNit(pedido.nit_cliente_final)) {
        missing.push("NIT real del cliente (formato numérico requerido para facturación)");
    }
    if (!pedido.items?.some(item => Number(item.cantidad) > 0)) missing.push("Productos y cantidades del pedido");

    return missing;
}

/**
 * Genera el modelo del documento formal a partir del pedido seleccionado.
 * Así el PDF/correo usa cantidades parciales y datos logísticos del pedido,
 * sin depender de los valores generales que pueda conservar la cotización.
 */
export function buildPedidoDocumentData(
    quote: LocalQuote,
    pedido: PedidoWithItems,
    quoteItems: LocalQuoteItem[],
    productCodes: Record<string, string> = {},
): { quote: LocalQuote; items: PedidoDocumentItem[] } {
    const documentQuote: LocalQuote = { ...quote };

    for (const field of PEDIDO_DOCUMENT_FIELDS) {
        const value = pedido[field];
        if (value !== undefined) {
            Object.assign(documentQuote, { [field]: value });
        }
    }

    const items = (pedido.items || []).map((pedidoItem): PedidoDocumentItem => {
        const quoteItem = quoteItems.find(item => item.producto_id === pedidoItem.producto_id);
        const unitPrice = Number(pedidoItem.precio_unitario ?? quoteItem?.precio_unitario ?? 0);
        const discountPct = Number(pedidoItem.descuento ?? quoteItem?.discount_pct ?? 0);
        const quantity = Number(pedidoItem.cantidad || 0);

        return {
            id: pedidoItem.id,
            cotizacion_id: quote.id,
            producto_id: pedidoItem.producto_id,
            cantidad: quantity,
            precio_unitario: unitPrice,
            discount_pct: discountPct,
            subtotal: unitPrice * quantity * (1 - discountPct / 100),
            descripcion_linea: quoteItem?.descripcion_linea || "Artículo",
            numero_articulo: productCodes[pedidoItem.producto_id] || pedidoItem.producto_id,
        };
    });

    documentQuote.total_amount = items.reduce((total, item) => total + item.subtotal, 0);

    return { quote: documentQuote, items };
}
