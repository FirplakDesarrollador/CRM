/**
 * Fecha real de cierre de una oportunidad (Cerrada Ganada / Cerrada Perdida).
 *
 * Planner "Funcionalidades CRM B2C_2": "cp y cg - lleve a reporte columna de
 * fecha de cierre" (CP = Cerrada Perdida, CG = Cerrada Ganada).
 *
 * La tabla no tiene una columna "fecha_cierre" real. Se toma, en este orden:
 *  1. `_sync_metadata.estado_id` (epoch ms del último cambio de estado, lo
 *     escribe la app/sync cuando se cierra la oportunidad).
 *  2. `_sync_metadata.fase_id` (mismo dato cuando el cierre fue por fase).
 *  3. `fecha_cierre_estimada` (en B2C la app la pone en "hoy" al cerrar, y en
 *     los datos migrados trae la fecha de cierre del CRM anterior).
 * Para oportunidades abiertas devuelve null.
 */

export const CLOSED_WON_ESTADO_ID = 2;
export const CLOSED_LOST_ESTADO_ID = 3;
export const CLOSED_ESTADO_IDS = [CLOSED_WON_ESTADO_ID, CLOSED_LOST_ESTADO_ID] as const;

type CloseDateInput = {
    estado_id?: number | string | null;
    fecha_cierre_estimada?: string | null;
    _sync_metadata?: Record<string, unknown> | null;
} | null | undefined;

export function isClosedOpportunity(opp: CloseDateInput): boolean {
    const estado = Number(opp?.estado_id);
    return estado === CLOSED_WON_ESTADO_ID || estado === CLOSED_LOST_ESTADO_ID;
}

/** Fecha YYYY-MM-DD en hora de Colombia. */
export function toBogotaDateString(date: Date): string {
    // en-CA da formato YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function epochFromMeta(meta: Record<string, unknown> | null | undefined, field: string): number | null {
    if (!meta || typeof meta !== 'object') return null;
    const raw = meta[field];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    // Descarta valores absurdos (antes de 2015 o vacíos)
    return Number.isFinite(n) && n > 1420070400000 ? n : null;
}

/** Devuelve la fecha de cierre (YYYY-MM-DD) o null si la oportunidad no está cerrada. */
export function resolveOpportunityCloseDate(opp: CloseDateInput): string | null {
    if (!opp || !isClosedOpportunity(opp)) return null;
    const meta = opp._sync_metadata ?? null;
    const ts = epochFromMeta(meta, 'estado_id') ?? epochFromMeta(meta, 'fase_id');
    if (ts !== null) return toBogotaDateString(new Date(ts));
    const est = opp.fecha_cierre_estimada;
    if (est && /^\d{4}-\d{2}-\d{2}/.test(est)) return est.slice(0, 10);
    return null;
}
