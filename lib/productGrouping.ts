import { PriceListProduct } from "@/lib/hooks/useProducts";
import { InventorySummary } from "@/lib/hooks/useInventory";

export const KNOWN_COLOR_MAP: Record<string, string> = {
    "0000": "Estándar / Sin color",
    "0001": "Natural",
    "0100": "Blanco",
    "0103": "Marfil",
    "0104": "Hueso",
    "0106": "Almendra",
    "0149": "Gris Claro",
    "0150": "Gris",
    "0155": "Gris Grafito",
    "0160": "Negro",
    "0300": "Cromo",
    "0321": "Titanio",
    "0322": "Bronce",
    "0323": "Oro Rosa",
    "0324": "Negro Mate",
    "0392": "Níquel Cepillado",
    "0403": "Cedro",
    "0406": "Ceniza",
    "0408": "Roble",
    "0437": "Soder / Mali",
    "0439": "Mitte / Tambo",
    "0442": "Gracia / Sikuani",
    "0447": "Carbono / Baudo",
    "0458": "Nogal",
    "0467": "Miel",
    "0485": "Caramelo",
    "0493": "Wengue",
    "0500": "Gris Niebla",
    "0503": "Gris Sombra",
    "0508": "Arena",
    "0509": "Taupe",
    "0901": "Brillante",
    "0904": "Mate",
    "1353": "Acero Inox",
    "1371": "Dorado",
    "1383": "Oro Cepillado",
    "1384": "Oro Brillante",
    "1388": "Cobre"
};

const COLOR_WORDS_REGEX = /\b(BLANCO|BLANCA|MARFIL|BONE|HUESO|NEGRO|NEGRA|GRIS NIEBLA|GRIS SOMBRA|GRIS|SODER\/MALI|MITTE\/TAMBO|GRACIA\/SIKUANI|CARBONO\/BAUDO|AUSTRAL|ROBLE|WENGUE|CROMO|TITANIO|BRONCE|ORO ROSA|NEGRO MATE)\b/gi;

export interface ProductColorVariant {
    id: string;
    numero_articulo: string;
    color_code: string;
    color_name: string;
    descripcion: string;
    disponible: number;
    planta?: string | null;
    familia?: string | null;
    distribuidor_pvp_iva: number | null;
    lista_base_cop: number | null;
    lista_base_obras: number | null;
    lista_base_exportaciones: number | null;
    pvp_sin_iva: number | null;
    precio_feria: number | null;
}

export interface GroupedCatalogProduct {
    id: string;
    baseCode: string;
    descripcion: string;
    planta?: string | null;
    familia?: string | null;
    distribuidor_pvp_iva: number | null;
    lista_base_cop: number | null;
    lista_base_obras: number | null;
    lista_base_exportaciones: number | null;
    pvp_sin_iva: number | null;
    precio_feria: number | null;
    totalDisponible: number;
    variants: ProductColorVariant[];
    hasAvailableVariant: boolean;
    hasFeriaVariant: boolean;
}

/**
 * Extrae el código base y el código de color de un SKU de Firplak.
 * Ejemplo: VBAN01-0038-000-0100 -> baseCode: "VBAN01-0038-000", colorCode: "0100"
 */
export function extractBaseAndColor(numero_articulo: string | null | undefined): {
    baseCode: string;
    colorCode: string;
    isGroupable: boolean;
} {
    if (!numero_articulo || !numero_articulo.includes("-")) {
        return {
            baseCode: numero_articulo || "",
            colorCode: "",
            isGroupable: false
        };
    }

    const parts = numero_articulo.trim().split("-");
    if (parts.length >= 4) {
        const colorCode = parts[parts.length - 1];
        const baseCode = parts.slice(0, parts.length - 1).join("-");
        return {
            baseCode,
            colorCode,
            isGroupable: true
        };
    }

    return {
        baseCode: numero_articulo.trim(),
        colorCode: "",
        isGroupable: false
    };
}

/**
 * Obtiene el nombre amigable del color dado su código y descripción opcional.
 */
export function getColorName(colorCode: string, description?: string): string {
    if (!colorCode) return "Sin color";
    const cleanedCode = colorCode.trim().toUpperCase();
    if (KNOWN_COLOR_MAP[cleanedCode]) {
        return KNOWN_COLOR_MAP[cleanedCode];
    }

    if (description) {
        const upperDesc = description.toUpperCase();
        for (const [code, name] of Object.entries(KNOWN_COLOR_MAP)) {
            if (code !== "0000" && code !== "0001" && upperDesc.includes(name.toUpperCase())) {
                return name;
            }
        }
    }

    return `Color ${colorCode}`;
}

/**
 * Remueve menciones al color específico de una descripción para generar una descripción base general.
 */
export function cleanProductDescription(description: string | null | undefined): string {
    if (!description) return "";
    let cleaned = description.replace(COLOR_WORDS_REGEX, "").trim();
    cleaned = cleaned
        .replace(/\s+-\s+/g, " - ")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s\-]+|[\s\-]+$/g, "")
        .trim();

    return cleaned || description;
}

/**
 * Agrupa una lista de PriceListProduct por su código base sin color.
 */
export function groupProductsByColor(
    products: PriceListProduct[],
    inventoryMap: Map<string, InventorySummary>
): GroupedCatalogProduct[] {
    const groupsMap = new Map<string, GroupedCatalogProduct>();

    for (const product of products) {
        const { baseCode, colorCode } = extractBaseAndColor(product.numero_articulo);
        const groupKey = baseCode || product.id;
        const stock = inventoryMap.get(product.id);
        const disponible = stock?.disponible || 0;
        const colorName = getColorName(colorCode, product.descripcion);

        const variant: ProductColorVariant = {
            id: product.id,
            numero_articulo: product.numero_articulo,
            color_code: colorCode,
            color_name: colorName,
            descripcion: product.descripcion,
            disponible,
            planta: product.planta,
            familia: product.familia,
            distribuidor_pvp_iva: product.distribuidor_pvp_iva,
            lista_base_cop: product.lista_base_cop,
            lista_base_obras: product.lista_base_obras,
            lista_base_exportaciones: product.lista_base_exportaciones,
            pvp_sin_iva: product.pvp_sin_iva,
            precio_feria: product.precio_feria
        };

        const existingGroup = groupsMap.get(groupKey);

        if (!existingGroup) {
            const cleanDesc = cleanProductDescription(product.descripcion);
            groupsMap.set(groupKey, {
                id: groupKey,
                baseCode: groupKey,
                descripcion: cleanDesc,
                planta: product.planta,
                familia: product.familia,
                distribuidor_pvp_iva: product.distribuidor_pvp_iva,
                lista_base_cop: product.lista_base_cop,
                lista_base_obras: product.lista_base_obras,
                lista_base_exportaciones: product.lista_base_exportaciones,
                pvp_sin_iva: product.pvp_sin_iva,
                precio_feria: product.precio_feria,
                totalDisponible: disponible,
                variants: [variant],
                hasAvailableVariant: disponible > 0,
                hasFeriaVariant: (product.precio_feria || 0) > 0
            });
        } else {
            existingGroup.variants.push(variant);
            existingGroup.totalDisponible += disponible;
            if (disponible > 0) {
                existingGroup.hasAvailableVariant = true;
            }
            if ((product.precio_feria || 0) > 0) {
                existingGroup.hasFeriaVariant = true;
            }

            if ((!existingGroup.distribuidor_pvp_iva || existingGroup.distribuidor_pvp_iva === 0) && (product.distribuidor_pvp_iva || 0) > 0) {
                existingGroup.distribuidor_pvp_iva = product.distribuidor_pvp_iva;
            }
            if ((!existingGroup.lista_base_cop || existingGroup.lista_base_cop === 0) && (product.lista_base_cop || 0) > 0) {
                existingGroup.lista_base_cop = product.lista_base_cop;
            }
            if ((!existingGroup.lista_base_obras || existingGroup.lista_base_obras === 0) && (product.lista_base_obras || 0) > 0) {
                existingGroup.lista_base_obras = product.lista_base_obras;
            }
            if ((!existingGroup.lista_base_exportaciones || existingGroup.lista_base_exportaciones === 0) && (product.lista_base_exportaciones || 0) > 0) {
                existingGroup.lista_base_exportaciones = product.lista_base_exportaciones;
            }
            if ((!existingGroup.pvp_sin_iva || existingGroup.pvp_sin_iva === 0) && (product.pvp_sin_iva || 0) > 0) {
                existingGroup.pvp_sin_iva = product.pvp_sin_iva;
            }
            if ((!existingGroup.precio_feria || existingGroup.precio_feria === 0) && (product.precio_feria || 0) > 0) {
                existingGroup.precio_feria = product.precio_feria;
            }

            if (colorCode === "0100") {
                existingGroup.descripcion = cleanProductDescription(product.descripcion);
            }
        }
    }

    const result = Array.from(groupsMap.values());
    for (const group of result) {
        group.variants.sort((a, b) => {
            if (a.color_code === "0100") return -1;
            if (b.color_code === "0100") return 1;
            if (a.color_code === "0103") return -1;
            if (b.color_code === "0103") return 1;
            return a.color_code.localeCompare(b.color_code);
        });
    }

    return result;
}
