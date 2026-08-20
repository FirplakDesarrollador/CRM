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
 * Verifica si `text` contiene `searchQuery` ignorando tildes y mayúsculas/minúsculas.
 */
export function includesNormalized(text: string | null | undefined, searchQuery: string | null | undefined): boolean {
    if (!text || !searchQuery) return false;
    return removeAccents(text).includes(removeAccents(searchQuery));
}

/**
 * Verifica si `text` contiene todas las palabras de `searchQuery` en cualquier orden, ignorando tildes y mayúsculas.
 */
export function matchesSearchTokens(text: string | null | undefined, searchQuery: string | null | undefined): boolean {
    if (!text || !searchQuery) return false;
    const normalizedText = removeAccents(text);
    const tokens = removeAccents(searchQuery).trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.every(token => normalizedText.includes(token));
}

