import type { Option } from "@/components/ui/MultiSelect";

export const OPPORTUNITY_CATEGORIES: Option[] = [
    { label: "Baños", value: "Baños" },
    { label: "Cocinas", value: "Cocinas" },
    { label: "Zona de Labores", value: "Zona de Labores" },
    { label: "Hidromasajes", value: "Hidromasajes" },
    { label: "Institucional", value: "Institucional" },
];

/**
 * Normaliza cualquier formato previo (string separado por comas, array o null/undefined) a un array de strings.
 */
export function parseOpportunityCategories(val: string | string[] | null | undefined): string[] {
    if (!val) return [];
    if (Array.isArray(val)) {
        return val.map(s => String(s).trim()).filter(Boolean);
    }
    return String(val)
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * Convierte un array o string de categorías a string formateado por comas para almacenamiento consistente.
 */
export function formatOpportunityCategories(categories: string | string[] | null | undefined): string {
    if (!categories) return "";
    const list = Array.isArray(categories) ? categories : parseOpportunityCategories(categories);
    if (list.length === 0) return "";
    return list
        .map(s => s.trim())
        .filter(Boolean)
        .join(", ");
}
