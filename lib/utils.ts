import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Normaliza un texto removiendo tildes y caracteres diacríticos, convirtiéndolo a minúsculas.
 */
export function removeAccents(str: string | null | undefined): string {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Obtiene los tokens limpios de un término de búsqueda en minúsculas y sin acentos.
 */
export function getSearchTokens(searchQuery: string | null | undefined): string[] {
    if (!searchQuery || !searchQuery.trim()) return [];
    return removeAccents(searchQuery).trim().split(/\s+/).filter(Boolean);
}

/**
 * Verifica si `text` contiene `searchQuery` ignorando tildes y mayúsculas/minúsculas.
 * Si no hay término de búsqueda o está vacío, retorna true.
 */
export function includesNormalized(text: string | null | undefined, searchQuery: string | null | undefined): boolean {
    if (!searchQuery || !searchQuery.trim()) return true;
    if (!text) return false;
    return removeAccents(text).includes(removeAccents(searchQuery).trim());
}

/**
 * Verifica si `text` o una lista de `texts` contiene todas las palabras de `searchQuery` en cualquier orden, ignorando tildes y mayúsculas.
 * Si no hay término de búsqueda o está vacío, retorna true.
 */
export function matchesSearchTokens(
    textOrTexts: string | null | undefined | (string | null | undefined)[],
    searchQuery: string | null | undefined
): boolean {
    if (!searchQuery || !searchQuery.trim()) return true;
    if (!textOrTexts) return false;

    const tokens = getSearchTokens(searchQuery);
    if (tokens.length === 0) return true;

    const combinedText = Array.isArray(textOrTexts)
        ? textOrTexts.filter(Boolean).join(" ")
        : String(textOrTexts);

    if (!combinedText) return false;
    const normalizedText = removeAccents(combinedText);

    return tokens.every(token => normalizedText.includes(token));
}


