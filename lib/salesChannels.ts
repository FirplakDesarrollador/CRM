import type { PriceListProduct } from "@/lib/hooks/useProducts";

type ProductPriceSource = Pick<
    PriceListProduct,
    "lista_base_cop" | "lista_base_exportaciones" | "lista_base_obras" | "distribuidor_pvp_iva" | "pvp_sin_iva" | "precio_feria"
>;

export const SALES_CHANNELS = [
    { id: "PROPIO", nombre: "Canal Propio" },
    { id: "DIST_NAC", nombre: "Distribución Nacional" },
    { id: "DIST_INT", nombre: "Distribución Internacional" },
    { id: "OBRAS_NAC", nombre: "Obras Nacional" },
    { id: "OBRAS_INT", nombre: "Obras Internacional" },
] as const;

export type SalesChannelId = (typeof SALES_CHANNELS)[number]["id"];

export function getProductPrice(
    product: ProductPriceSource,
    channelId: string,
    isFairSale = false,
): number {
    if (isFairSale) {
        return Number(product.precio_feria) || 0;
    }

    const priceByChannel: Record<string, number> = {
        PROPIO: Number(product.pvp_sin_iva) || 0,
        DIST_NAC: Number(product.lista_base_cop) || 0,
        DIST_INT: Number(product.lista_base_exportaciones) || 0,
        OBRAS_NAC: Number(product.lista_base_obras) || 0,
        OBRAS_INT: Number(product.lista_base_exportaciones) || 0,
    };

    return priceByChannel[channelId]
        || Number(product.lista_base_cop)
        || Number(product.pvp_sin_iva)
        || 0;
}

/**
 * Retorna el texto clarificador de la columna de origen de la lista de precios y su condición de IVA.
 * Todos los precios base en Firplak se manejan sin IVA en cotizaciones y pedidos.
 */
export function getPriceClarification(
    channelId?: string,
    isExport = false,
    isManual = false,
): string {
    if (isManual) {
        return "Ítem manual (sin IVA)";
    }

    if (isExport) {
        return "Columna: lista_base_exportaciones (sin IVA)";
    }

    switch (channelId) {
        case "OBRAS_NAC":
            return "Columna: lista_base_obras (sin IVA)";
        case "OBRAS_INT":
        case "DIST_INT":
            return "Columna: lista_base_exportaciones (sin IVA)";
        case "PROPIO":
            return "Columna: pvp_sin_iva (sin IVA)";
        case "DIST_NAC":
        default:
            return "Columna: lista_base_cop (sin IVA)";
    }
}
