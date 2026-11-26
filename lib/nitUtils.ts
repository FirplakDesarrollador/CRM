/**
 * Utilidades para generación, sanitización y validación de NITs (Reales vs Provisionales).
 *
 * Regla de negocio:
 * - Cuentas creadas sin NIT reciben automáticamente un NIT alfanumérico provisional (ej. PROV-A1B2C3D4).
 * - Los NITs provisionales permiten guardar y sincronizar la cuenta sin violar restricciones de unicidad.
 * - Al digitar un NIT real colombiano: solo números (5 a 12 dígitos) y opcionalmente un único guion
 *   seguido de 1 dígito de verificación (ej. 890927404-0 o 1037654321). No se permiten puntos,
 *   espacios, letras ni más de un guion.
 */

const REAL_NIT_REGEX = /^\d{5,12}(-\d)?$/;

/**
 * Genera un NIT alfanumérico provisional único con prefijo 'PROV-'.
 */
export function generateProvisionalNit(): string {
    let hex = "";
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        hex = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
    } else {
        hex = Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    return `PROV-${hex}`;
}

/**
 * Determina si un NIT es provisional (generado automáticamente).
 */
export function isProvisionalNit(nit?: string | null): boolean {
    if (!nit || typeof nit !== "string") return false;
    const trimmed = nit.trim();
    return /^PROV-[A-Z0-9]+$/i.test(trimmed);
}

/**
 * Sanitiza la entrada de un NIT en tiempo real (teclado o pegado).
 * - Elimina puntos, espacios, letras y cualquier carácter distinto de dígito o guion.
 * - Impide un guion al inicio.
 * - Permite máximo UN guion, máximo 12 dígitos antes del guion y máximo 1 dígito después.
 */
export function sanitizeNitInput(raw?: string | null): string {
    if (raw === null || raw === undefined) return "";
    const str = String(raw);

    let root = "";
    let hasHyphen = false;
    let dv = "";

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch >= "0" && ch <= "9") {
            if (!hasHyphen) {
                if (root.length < 12) root += ch;
            } else if (dv.length < 1) {
                dv += ch;
            }
        } else if (ch === "-") {
            if (!hasHyphen && root.length > 0) {
                hasHyphen = true;
            }
        }
    }

    return hasHyphen ? `${root}-${dv}` : root;
}

/**
 * Extrae la raíz numérica del NIT (todos los dígitos anteriores al primer guion).
 * Útil para detectar duplicados independientemente de si incluyen o no dígito de verificación o puntos.
 * Retorna "" para NITs vacíos o provisionales (PROV-*).
 */
export function extractNitRoot(nit?: string | null): string {
    if (nit === null || nit === undefined) return "";
    const trimmed = String(nit).trim();
    if (!trimmed || isProvisionalNit(trimmed)) return "";

    const beforeHyphen = trimmed.split("-")[0] ?? "";
    return beforeHyphen.replace(/\D/g, "");
}

/**
 * Valida si un NIT tiene un formato numérico real válido (Cédula o NIT con dígito de verificación opcional).
 * Rechaza NITs provisionales, puntos, espacios, doble guion o formatos inválidos.
 */
export function isValidRealNit(nit?: string | null): boolean {
    if (nit === null || nit === undefined) return false;
    const trimmed = String(nit).trim();
    if (isProvisionalNit(trimmed)) return false;

    return REAL_NIT_REGEX.test(trimmed);
}

/**
 * Valida un campo de NIT opcional en formularios de cuentas.
 * - Vacío / null: válido (el sistema asignará NIT provisional al guardar).
 * - Si tiene texto: debe cumplir estrictamente el formato colombiano (5-12 dígitos, guion y 1 DV opcional).
 */
export function validateColombianNit(nit?: string | null): boolean {
    if (nit === null || nit === undefined) return true;
    const trimmed = String(nit).trim();
    if (trimmed === "") return true;
    return isValidRealNit(trimmed);
}
