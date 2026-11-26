import { extractNitRoot } from "@/lib/nitUtils";

export type SimilarityMatchReason = "NIT" | "NOMBRE" | "AMBOS";

export interface SimilarAccountMatch {
    id: string;
    nombre: string;
    nit_base: string | null;
    canal_id: string | null;
    id_cuenta_principal: string | null;
    root_id: string;
    root_nombre: string;
    root_nit_base: string | null;
    owner_user_id: string | null;
    owner_name: string | null;
    owner_zona: string | null;
    match_reason: SimilarityMatchReason;
    similarity_score: number;
}

export interface RootAccountTarget {
    id: string;
    nombre: string;
    nit_base: string | null;
    canal_id: string | null;
}

export interface SimilarityAlertSummary {
    hasHighNameMatch: boolean;
    hasNitMatch: boolean;
    topNameMatch: SimilarAccountMatch | null;
    topNitMatch: SimilarAccountMatch | null;
}

export const HIGH_NAME_SIMILARITY_THRESHOLD = 0.55;

const LEGAL_SUFFIX_REGEX = /\b(s\s*a\s*s|s\s*a|ltda|limitada|cia|e\s*u|s\s*en\s*c|inc|llc|corp)\b/gi;

/**
 * Normaliza un nombre de cuenta para comparaciones difusas consistentes:
 * minúsculas, sin tildes, sin signos de puntuación, sin sufijos societarios comunes
 * y con espacios colapsados.
 */
export function normalizeAccountName(name?: string | null): string {
    if (!name) return "";
    return String(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(LEGAL_SUFFIX_REGEX, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Genera el nombre de la nueva sucursal respetando el nombre de la cuenta matriz
 * y anexando la zona comercial del asesor sin duplicarla si ya está presente.
 */
export function buildBranchAccountName(parentName: string, zoneName: string): string {
    const cleanParent = String(parentName || "").replace(/\s+/g, " ").trim();
    const cleanZone = String(zoneName || "").replace(/\s+/g, " ").trim();
    if (!cleanParent) return cleanZone;
    if (!cleanZone) return cleanParent;

    const normalizedParent = normalizeAccountName(cleanParent);
    const normalizedZone = normalizeAccountName(cleanZone);
    if (normalizedZone && normalizedParent.endsWith(normalizedZone)) {
        return cleanParent;
    }

    return `${cleanParent} - ${cleanZone}`;
}

/**
 * Si una coincidencia ya es una sucursal, resuelve hacia su cuenta matriz para
 * mantener jerarquías planas de máximo 2 niveles (Matriz -> Sucursal).
 */
export function resolveRootAccountTarget(match: SimilarAccountMatch): RootAccountTarget {
    return {
        id: match.root_id || match.id_cuenta_principal || match.id,
        nombre: match.root_nombre || match.nombre,
        nit_base: match.root_nit_base ?? match.nit_base ?? null,
        canal_id: match.canal_id ?? null,
    };
}

/**
 * Evalúa si el nombre o NIT digitado presenta alta coincidencia con cuentas existentes
 * (detectando también intentos de evasión como espacios extra, omisión de palabras o variar el DV).
 */
export function evaluateSimilarityAlerts(params: {
    inputName?: string | null;
    inputNit?: string | null;
    matches: SimilarAccountMatch[];
    isBranchMode: boolean;
    selectedParentId?: string | null;
}): SimilarityAlertSummary {
    const { inputName, inputNit, matches, isBranchMode, selectedParentId } = params;

    if (!matches || matches.length === 0) {
        return {
            hasHighNameMatch: false,
            hasNitMatch: false,
            topNameMatch: null,
            topNitMatch: null,
        };
    }

    const normalizedInputName = normalizeAccountName(inputName);
    const inputNitRoot = extractNitRoot(inputNit);

    // Filtrar coincidencias que pertenecen a la misma jerarquía padre cuando ya se activó modo sucursal
    const relevantMatches = matches.filter((match) => {
        if (!isBranchMode || !selectedParentId) return true;
        const matchRootId = match.root_id || match.id_cuenta_principal || match.id;
        return matchRootId !== selectedParentId;
    });

    let topNitMatch: SimilarAccountMatch | null = null;
    let topNameMatch: SimilarAccountMatch | null = null;

    for (const match of relevantMatches) {
        const matchNitRoot = extractNitRoot(match.nit_base);
        const nitMatches =
            Boolean(inputNitRoot && inputNitRoot.length >= 5) &&
            (match.match_reason === "NIT" ||
                match.match_reason === "AMBOS" ||
                (Boolean(matchNitRoot) && matchNitRoot === inputNitRoot));

        if (nitMatches && !topNitMatch) {
            topNitMatch = match;
        }

        const normalizedMatchName = normalizeAccountName(match.nombre);
        const strongContainment =
            normalizedInputName.length >= 4 &&
            normalizedMatchName.length >= 4 &&
            (normalizedMatchName.includes(normalizedInputName) ||
                normalizedInputName.includes(normalizedMatchName));

        const highNameScore =
            normalizedInputName.length >= 3 &&
            (match.similarity_score >= HIGH_NAME_SIMILARITY_THRESHOLD || strongContainment);

        if (highNameScore) {
            if (!topNameMatch || match.similarity_score > topNameMatch.similarity_score) {
                topNameMatch = match;
            }
        }
    }

    return {
        hasHighNameMatch: Boolean(topNameMatch),
        hasNitMatch: Boolean(topNitMatch),
        topNameMatch,
        topNitMatch,
    };
}

/**
 * Construye el mensaje de aseguramiento mostrado al asesor cuando insiste en crear
 * una cuenta con alta similitud en nombre o NIT frente a un cliente existente.
 */
export function buildSimilarityConfirmationMessage(params: {
    matchName: string;
    ownerName?: string | null;
    matchReason?: SimilarityMatchReason;
}): string {
    const owner = params.ownerName?.trim() || "Sin asesor asignado";
    const matchLabel =
        params.matchReason === "NIT"
            ? "en el NIT"
            : params.matchReason === "AMBOS"
            ? "en el nombre y el NIT"
            : "en el nombre";

    return (
        `El cliente ingresado tiene alta coincidencia ${matchLabel} con "${params.matchName}" (Asesor: ${owner}). ` +
        `Si corresponde a la misma empresa en tu regional, cancela y usa "Crear cuenta nueva en mi sucursal". ` +
        `Si decides crear esta cuenta de todas formas, se notificará a la coordinación comercial.`
    );
}

