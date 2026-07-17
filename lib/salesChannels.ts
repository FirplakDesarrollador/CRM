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
    { id: "FERIA", nombre: "Feria" },
] as const;

export type SalesChannelId = (typeof SALES_CHANNELS)[number]["id"];

export function getProductPrice(
    product: ProductPriceSource,
    channelId: string,
    isFairSale = false,
): number {
    if (isFairSale || channelId === "FERIA") {
        return Number(product.precio_feria) || 0;
    }

    const priceByChannel: Record<string, number> = {
        PROPIO: Number(product.distribuidor_pvp_iva) || 0,
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
