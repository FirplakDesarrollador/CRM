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
 * Formatea un número usando el estándar de separadores de Colombia (punto para miles, coma para decimales).
 */
export function formatNumberCO(amount: number | null | undefined, maxDecimals: number = 2): string {
    if (amount === null || amount === undefined || isNaN(amount)) return '0';
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
    }).format(amount);
}

/**
 * Formatea el valor de una oportunidad con su código de moneda y separadores es-CO.
 * Ej: 152266785.2, 'COP' -> "COP 152.266.785,2"
 */
export function formatOpportunityAmount(amount: number | null | undefined, currency: string = 'COP'): string {
    const formatted = formatNumberCO(amount, 2);
    return `${currency || 'COP'} ${formatted}`;
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

// Variantes con tilde/eñe de cada letra, para buscar en el servidor sin depender de tildes.
const ACCENT_VARIANTS: Record<string, string> = {
    a: '[aáàäâãAÁÀÄÂÃ]',
    e: '[eéèëêEÉÈËÊ]',
    i: '[iíìïîIÍÌÏÎ]',
    o: '[oóòöôõOÓÒÖÔÕ]',
    u: '[uúùüûUÚÙÜÛ]',
    n: '[nñNÑ]',
    c: '[cçCÇ]',
};

/**
 * Convierte un token de búsqueda (ya sin tildes, ver getSearchTokens) en una expresión regular
 * POSIX que ignora tildes y eñes, para usar con `imatch` (~*) en Supabase.
 * Ej.: "cataluna" -> encuentra "CATALUÑA"; "perez" -> encuentra "Pérez".
 * Devuelve null si el token tiene caracteres especiales (en ese caso usar ilike).
 */
export function accentInsensitiveRegex(token: string | null | undefined): string | null {
    const normalized = removeAccents(token || '').trim();
    if (!normalized || !/^[a-z0-9\-_@#\/&]+$/.test(normalized)) return null;
    return normalized.split('').map(ch => ACCENT_VARIANTS[ch] || ch).join('');
}

/**
 * Condición PostgREST (para usar dentro de `.or()`) que busca `token` en `column`
 * ignorando mayúsculas y tildes. Ej.: `nombre.imatch."c[aá...]t..."`.
 */
export function accentInsensitiveCondition(column: string, token: string): string {
    const regex = accentInsensitiveRegex(token);
    // Entre comillas: los corchetes de la expresión no se confunden con la sintaxis de `.or()`.
    return regex ? `${column}.imatch."${regex}"` : `${column}.ilike.%${token}%`;
}

/**
 * Aplica a una consulta de Supabase el filtro "column contiene token" ignorando tildes y mayúsculas.
 */
export function applyAccentInsensitiveFilter<Q>(query: Q, column: string, token: string): Q {
    const regex = accentInsensitiveRegex(token);
    // Constructor de consultas de Supabase (PostgrestFilterBuilder); `filter` genera `column=imatch.<regex>`.
    const builder = query as unknown as {
        filter: (column: string, operator: string, value: string) => Q;
        ilike: (column: string, pattern: string) => Q;
    };
    return regex ? builder.filter(column, 'imatch', regex) : builder.ilike(column, `%${token}%`);
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
 * Deja solo los dígitos de un texto (útil para comparar teléfonos con distintos formatos:
 * "+57 300 123 4567", "(300) 123-4567", "3001234567").
 */
export function digitsOnly(text: string | null | undefined): string {
    if (!text) return "";
    return String(text).replace(/\D/g, "");
}

/**
 * Indica si un término de búsqueda parece un número de teléfono/celular:
 * solo dígitos y separadores comunes (+ - ( ) . espacio) con al menos `minDigits` dígitos.
 */
export function isPhoneLikeQuery(query: string | null | undefined, minDigits: number = 4): boolean {
    if (!query) return false;
    const trimmed = query.trim();
    if (!trimmed || !/^[+(\d][\d\s().+-]*$/.test(trimmed)) return false;
    return digitsOnly(trimmed).length >= minDigits;
}

/**
 * Patrones `ilike` (PostgREST/Postgres) para buscar un teléfono en una columna de texto sin importar
 * el formato guardado. Para números largos permite separadores intermedios ("300 123 4567").
 */
export function getPhoneIlikePatterns(query: string | null | undefined): string[] {
    if (!isPhoneLikeQuery(query)) return [];
    const digits = digitsOnly(query);
    const patterns = new Set<string>([`%${digits}%`]);
    if (digits.length >= 7) patterns.add(`%${digits.split("").join("%")}%`);
    return Array.from(patterns);
}

/**
 * Verifica si `text` o una lista de `texts` contiene todas las palabras de `searchQuery` en cualquier orden, ignorando tildes y mayúsculas.
 * Si no hay término de búsqueda o está vacío, retorna true.
 * Las palabras numéricas (ej. un celular) también se comparan contra los dígitos del texto, de modo que
 * "3001234567" encuentra "+57 300 123 4567".
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
    // Lazily computed: only needed when a token is a number such as a phone.
    let textDigits: string | null = null;

    return tokens.every(token => {
        if (normalizedText.includes(token)) return true;
        const tokenDigits = digitsOnly(token);
        if (tokenDigits.length >= 4 && isPhoneLikeQuery(token)) {
            if (textDigits === null) textDigits = digitsOnly(combinedText);
            return textDigits.includes(tokenDigits);
        }
        return false;
    });
}
