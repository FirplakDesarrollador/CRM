/**
 * Preferencias de columnas de la tabla de Oportunidades (home), por usuario.
 *
 * Planner "Funcionalidades CRM B2C_2": "en home oportunidad cada usuario pueda
 * organizar las columnas". Cada usuario guarda su propio orden y sus columnas
 * ocultas en localStorage, con una clave que incluye su id. Se guardan las
 * columnas OCULTAS (no las visibles) para que una columna nueva aparezca sola.
 */

export interface OpportunityTablePrefs {
    /** Orden de todas las columnas conocidas (visibles u ocultas). */
    order: string[];
    /** Columnas que el usuario ocultó. */
    hidden: string[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const OPPORTUNITY_TABLE_PREFS_PREFIX = 'crm_opp_table_prefs_v1_';
const LEGACY_VISIBLE_KEYS = [
    'crm_opp_visible_cols_v4',
    'crm_opp_visible_cols_v3',
    'crm_opp_visible_cols_v2',
    'crm_opp_visible_cols',
];

export function opportunityTablePrefsKey(userId?: string | null): string {
    return `${OPPORTUNITY_TABLE_PREFS_PREFIX}${userId || 'default'}`;
}

/** Deja solo columnas conocidas, sin repetir, y agrega al final las nuevas. */
export function normalizeColumnOrder(saved: unknown, defaults: readonly string[]): string[] {
    const known = new Set(defaults);
    const seen = new Set<string>();
    const result: string[] = [];
    if (Array.isArray(saved)) {
        for (const k of saved) {
            if (typeof k === 'string' && known.has(k) && !seen.has(k)) {
                seen.add(k);
                result.push(k);
            }
        }
    }
    for (const k of defaults) if (!seen.has(k)) result.push(k);
    return result;
}

export function normalizePrefs(raw: unknown, defaults: readonly string[]): OpportunityTablePrefs {
    const obj = (raw && typeof raw === 'object') ? raw as Partial<OpportunityTablePrefs> : {};
    const known = new Set(defaults);
    const hidden = Array.isArray(obj.hidden)
        ? Array.from(new Set(obj.hidden.filter((k): k is string => typeof k === 'string' && known.has(k))))
        : [];
    return { order: normalizeColumnOrder(obj.order, defaults), hidden };
}

export function defaultOpportunityTablePrefs(defaults: readonly string[]): OpportunityTablePrefs {
    return { order: [...defaults], hidden: [] };
}

/** Carga las preferencias del usuario. Si no tiene, usa la lista vieja de visibles (global). */
export function loadOpportunityTablePrefs(
    storage: StorageLike | null | undefined,
    userId: string | null | undefined,
    defaults: readonly string[]
): OpportunityTablePrefs {
    if (!storage) return defaultOpportunityTablePrefs(defaults);
    try {
        const raw = storage.getItem(opportunityTablePrefsKey(userId));
        if (raw) return normalizePrefs(JSON.parse(raw), defaults);
        for (const legacyKey of LEGACY_VISIBLE_KEYS) {
            const legacy = storage.getItem(legacyKey);
            if (!legacy) continue;
            const visible = JSON.parse(legacy);
            if (Array.isArray(visible) && visible.length > 0) {
                const visibleSet = new Set(visible);
                return { order: [...defaults], hidden: defaults.filter(k => !visibleSet.has(k)) };
            }
        }
    } catch {
        // JSON dañado: se ignora y se usan las columnas por defecto.
    }
    return defaultOpportunityTablePrefs(defaults);
}

export function saveOpportunityTablePrefs(
    storage: StorageLike | null | undefined,
    userId: string | null | undefined,
    prefs: OpportunityTablePrefs
): void {
    if (!storage) return;
    try {
        storage.setItem(opportunityTablePrefsKey(userId), JSON.stringify(prefs));
    } catch {
        // localStorage lleno o bloqueado: la preferencia solo dura la sesión.
    }
}

/** Mueve una columna una posición (-1 izquierda / arriba, +1 derecha / abajo). */
export function moveColumnStep(order: readonly string[], key: string, delta: -1 | 1): string[] {
    const from = order.indexOf(key);
    if (from < 0) return [...order];
    return moveColumnTo(order, from, from + delta);
}

/** Mueve la columna de la posición `from` a la posición `to`. */
export function moveColumnTo(order: readonly string[], from: number, to: number): string[] {
    const next = [...order];
    if (from < 0 || from >= next.length) return next;
    const target = Math.max(0, Math.min(next.length - 1, to));
    if (target === from) return next;
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    return next;
}

export function toggleHiddenColumn(prefs: OpportunityTablePrefs, key: string): OpportunityTablePrefs {
    const hidden = prefs.hidden.includes(key)
        ? prefs.hidden.filter(k => k !== key)
        : [...prefs.hidden, key];
    return { ...prefs, hidden };
}

/** Columnas activas en el orden del usuario (o en el orden por defecto si no puede reordenar). */
export function activeColumnKeys(
    prefs: OpportunityTablePrefs,
    defaults: readonly string[],
    useCustomOrder: boolean
): string[] {
    const hidden = new Set(prefs.hidden);
    const order = useCustomOrder ? normalizeColumnOrder(prefs.order, defaults) : [...defaults];
    return order.filter(k => !hidden.has(k));
}
