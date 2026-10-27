/**
 * Helpers para recordar y sugerir asuntos de actividades, así los asesores no
 * tienen que copiar a mano el mismo asunto (ej. "2. Seguimiento Setter").
 */

const STORAGE_PREFIX = "crm_recent_activity_subjects";
const MAX_RECENT = 10;

const storageKey = (userId?: string | null) => `${STORAGE_PREFIX}:${userId || "anon"}`;

const cleanSubject = (value: unknown): string =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

export function getRecentSubjects(userId?: string | null): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(storageKey(userId));
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(cleanSubject).filter(Boolean).slice(0, MAX_RECENT) : [];
    } catch {
        return [];
    }
}

export function rememberSubject(subject: string, userId?: string | null): void {
    const clean = cleanSubject(subject);
    if (!clean || typeof window === "undefined") return;
    try {
        const current = getRecentSubjects(userId).filter((s) => s.toLowerCase() !== clean.toLowerCase());
        window.localStorage.setItem(storageKey(userId), JSON.stringify([clean, ...current].slice(0, MAX_RECENT)));
    } catch {
        // localStorage lleno o bloqueado: no es crítico
    }
}

const NUMBERED_RE = /^(?:seguimiento:\s*)*(\d+)\s*[.)-]\s*(.+)$/i;

/** "1. Seguimiento Setter" -> { n: 1, rest: "Seguimiento Setter" } */
export function parseNumberedSubject(subject: string): { n: number; rest: string } | null {
    const m = cleanSubject(subject).match(NUMBERED_RE);
    if (!m) return null;
    return { n: Number(m[1]), rest: m[2].trim() };
}

/**
 * Dado un conjunto de asuntos previos (de la misma oportunidad), devuelve el
 * siguiente de cada serie numerada: ["1. Seguimiento Setter"] -> ["2. Seguimiento Setter"].
 */
export function nextNumberedSubjects(previous: string[]): string[] {
    const maxByRest = new Map<string, { n: number; rest: string }>();
    for (const s of previous) {
        const parsed = parseNumberedSubject(s);
        if (!parsed) continue;
        const key = parsed.rest.toLowerCase();
        const cur = maxByRest.get(key);
        if (!cur || parsed.n > cur.n) maxByRest.set(key, parsed);
    }
    return [...maxByRest.values()].map(({ n, rest }) => `${n + 1}. ${rest}`);
}

/** Asunto prellenado al programar el seguimiento de una actividad completada. */
export function buildFollowUpSubject(previousSubject?: string | null): string | undefined {
    const clean = cleanSubject(previousSubject);
    if (!clean) return undefined;
    const parsed = parseNumberedSubject(clean);
    if (parsed) return `${parsed.n + 1}. ${parsed.rest}`;
    if (/^seguimiento\b/i.test(clean)) return clean;
    return `Seguimiento: ${clean}`;
}

/** Une listas sin duplicados (sin distinguir mayúsculas), respetando el orden. */
export function uniqueSubjects(lists: string[][], exclude?: string, limit = 6): string[] {
    const seen = new Set<string>();
    const ex = cleanSubject(exclude).toLowerCase();
    const out: string[] = [];
    for (const list of lists) {
        for (const s of list) {
            const clean = cleanSubject(s);
            const key = clean.toLowerCase();
            if (!clean || key === ex || seen.has(key)) continue;
            seen.add(key);
            out.push(clean);
            if (out.length >= limit) return out;
        }
    }
    return out;
}
