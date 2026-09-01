/**
 * Utilidades para generación y validación de NITs (Reales vs Provisionales).
 * 
 * Regla de negocio:
 * - Cuentas creadas sin NIT reciben automáticamente un NIT alfanumérico provisional (ej. PROV-A1B2C3D4).
 * - Los NITs provisionales permiten guardar y sincronizar la cuenta sin violar restricciones de unicidad.
 * - Sin embargo, para formalizar pedidos, se exige obligatoriamente un NIT numérico real (ej. 890927404-0).
 */

/**
 * Genera un NIT alfanumérico provisional único con prefijo 'PROV-'.
 */
export function generateProvisionalNit(): string {
    // Si estamos en entorno navegador/Node con crypto.randomUUID
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
 * Valida si un NIT tiene un formato numérico real válido (Cédula o NIT con dígito de verificación).
 * Rechaza NITs provisionales, cadenas con letras o formatos inválidos.
 */
export function isValidRealNit(nit?: string | null): boolean {
    if (!nit || typeof nit !== "string") return false;
    const trimmed = nit.trim();
    if (isProvisionalNit(trimmed)) return false;

    // Acepta entre 5 y 12 dígitos, opcionalmente con un guion y 1 dígito de verificación (ej. 890927404-0 o 1037654321)
    return /^\d{5,12}(-\d)?$/.test(trimmed);
}
