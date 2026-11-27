/**
 * Utilidades para generación, sanitización y validación de NITs (Reales, Sucursales y Provisionales).
 *
 * Reglas de negocio:
 * - Cuentas creadas sin NIT reciben automáticamente un NIT alfanumérico provisional (ej. PROV-A1B2C3D4).
 * - Cuentas raíz: solo números (5 a 12 dígitos) y opcionalmente un único guion seguido de 1 dígito
 *   de verificación (ej. 900510728-6 o 1037654321). No se permiten puntos, espacios, letras ni más de un guion.
 * - Sucursales: heredan el NIT de la cuenta padre agregando el indicativo # y consecutivo desde #2
 *   (ej. 900510728-6#2, 900510728-6#3).
 */

const ROOT_NIT_REGEX = /^\d{5,12}(-\d)?$/;
const BRANCH_ALLOWED_NIT_REGEX = /^\d{5,12}(-\d)?(#\d+)?$/;

export interface NitValidationOptions {
    allowBranchSuffix?: boolean;
}

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
 * Determina si un NIT es provisional (generado automáticamente), incluyendo sucursales provisionales.
 */
export function isProvisionalNit(nit?: string | null): boolean {
    if (!nit || typeof nit !== "string") return false;
    const trimmed = nit.trim();
    return /^PROV-[A-Z0-9]+(#\d+)?$/i.test(trimmed);
}

/**
 * Sanitiza la entrada de un NIT en tiempo real (teclado o pegado).
 * - Elimina puntos, espacios, letras y caracteres inválidos.
 * - Impide guion o # al inicio.
 * - Permite máximo UN guion, máximo 12 dígitos antes del guion y máximo 1 dígito después.
 * - Si allowBranchSuffix=true (sucursales), permite además UN único # al final seguido de dígitos (ej. 900510728-6#2).
 */
export function sanitizeNitInput(raw?: string | null, options?: NitValidationOptions): string {
    if (raw === null || raw === undefined) return "";
    const str = String(raw);
    const allowBranchSuffix = Boolean(options?.allowBranchSuffix);

    let root = "";
    let hasHyphen = false;
    let dv = "";
    let hasHash = false;
    let branchSuffix = "";

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch >= "0" && ch <= "9") {
            if (hasHash) {
                if (branchSuffix.length < 4) branchSuffix += ch;
            } else if (!hasHyphen) {
                if (root.length < 12) root += ch;
            } else if (dv.length < 1) {
                dv += ch;
            }
        } else if (ch === "-") {
            if (!hasHyphen && !hasHash && root.length > 0) {
                hasHyphen = true;
            }
        } else if (ch === "#" && allowBranchSuffix) {
            if (hasHash && branchSuffix.length > 0) {
                break;
            }
            if (!hasHash && root.length > 0 && (!hasHyphen || dv.length === 1)) {
                hasHash = true;
            }
        }
    }

    let result = hasHyphen ? `${root}-${dv}` : root;
    if (hasHash) {
        result += `#${branchSuffix}`;
    }
    return result;
}

/**
 * Extrae la raíz numérica del NIT (dígitos anteriores a '#' y '-').
 * Útil para detectar duplicados independientemente del DV o sufijo de sucursal.
 * Retorna "" para NITs vacíos o provisionales (PROV-*).
 */
export function extractNitRoot(nit?: string | null): string {
    if (nit === null || nit === undefined) return "";
    const trimmed = String(nit).trim();
    if (!trimmed || isProvisionalNit(trimmed)) return "";

    const beforeHash = trimmed.split("#")[0] ?? "";
    const beforeHyphen = beforeHash.split("-")[0] ?? "";
    return beforeHyphen.replace(/\D/g, "");
}

/**
 * Valida si un NIT tiene un formato numérico real válido (Cédula, NIT con DV opcional o NIT de sucursal con #N).
 * Rechaza NITs provisionales, puntos, espacios, doble guion o formatos inválidos.
 */
export function isValidRealNit(nit?: string | null): boolean {
    if (nit === null || nit === undefined) return false;
    const trimmed = String(nit).trim();
    if (isProvisionalNit(trimmed)) return false;

    return BRANCH_ALLOWED_NIT_REGEX.test(trimmed);
}

/**
 * Valida un campo de NIT opcional en formularios de cuentas.
 * - Vacío / null: válido (el sistema asignará NIT provisional al guardar).
 * - Por defecto (cuenta raíz): solo 5-12 dígitos + '-DV' opcional (sin '#').
 * - Con allowBranchSuffix=true (sucursal): permite además '#N' (ej. 900510728-6#2).
 */
export function validateColombianNit(nit?: string | null, options?: NitValidationOptions): boolean {
    if (nit === null || nit === undefined) return true;
    const trimmed = String(nit).trim();
    if (trimmed === "") return true;
    if (isProvisionalNit(trimmed)) return false;

    return options?.allowBranchSuffix
        ? BRANCH_ALLOWED_NIT_REGEX.test(trimmed)
        : ROOT_NIT_REGEX.test(trimmed);
}

/**
 * Calcula automáticamente el NIT de una nueva sucursal como `<NIT_PADRE>#<N>` empezando en `#2`
 * (ej. `900510728-6` -> `900510728-6#2`, y si ya existe `#2` -> `900510728-6#3`).
 */
export function buildBranchNit(
    parentNit?: string | null,
    existingBranchNits: Array<string | null | undefined> = []
): string {
    const cleanParent = String(parentNit || "").trim().split("#")[0]?.trim() || "";
    if (!cleanParent) return "";

    let maxSuffix = 0;
    for (const branchNit of existingBranchNits) {
        const match = String(branchNit || "").trim().match(/#(\d+)$/);
        if (match) {
            const parsed = Number.parseInt(match[1], 10);
            if (Number.isFinite(parsed) && parsed > maxSuffix) {
                maxSuffix = parsed;
            }
        }
    }

    const nextNumber = Math.max(existingBranchNits.length + 2, maxSuffix + 1, 2);
    return `${cleanParent}#${nextNumber}`;
}
