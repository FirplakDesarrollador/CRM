/**
 * Reglas de seguridad y validación de precios para cotizaciones.
 * Protege contra manipulación manual de precios en ítems del catálogo.
 */

export interface QuoteItemLike {
    producto_id?: string | null;
    precio_unitario?: number;
    cantidad?: number;
    discount_pct?: number;
    final_unit_price?: number;
    subtotal?: number;
    [key: string]: any;
}

/**
 * Determina si un ítem de cotización es manual (no vinculado al catálogo maestro).
 */
export function isManualQuoteItem(item?: { producto_id?: string | null } | null): boolean {
    return !item || item.producto_id === null || item.producto_id === undefined;
}

/**
 * Determina si el precio unitario de un ítem puede ser editado directamente en la cotización.
 * Solo los ítems manuales permiten fijar/editar precio unitario libremente.
 * Los productos del catálogo tienen precio protegido por la lista de precios oficial.
 */
export function isQuoteItemPriceEditable(item?: { producto_id?: string | null } | null): boolean {
    return isManualQuoteItem(item);
}

/**
 * Sanitiza las actualizaciones de un ítem de cotización para evitar que un asesor o cliente
 * manipule arbitrariamente el `precio_unitario` de un producto del catálogo.
 * 
 * Si el ítem es de catálogo (`producto_id !== null`), elimina `precio_unitario` del objeto de cambios.
 */
export function sanitizeQuoteItemUpdates<T extends Record<string, any>>(
    current: { producto_id?: string | null },
    updates: T
): T {
    const cleanUpdates = { ...updates };

    // Si NO es editable (es producto del catálogo), descartamos cualquier mutación manual de precio_unitario
    if (!isQuoteItemPriceEditable(current) && 'precio_unitario' in cleanUpdates) {
        delete cleanUpdates.precio_unitario;
    }

    return cleanUpdates;
}
