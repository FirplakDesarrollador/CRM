/**
 * Fecha real de cierre de una oportunidad (Cerrada Ganada / Cerrada Perdida).
 *
 * Planner "Funcionalidades CRM B2C_2": "cp y cg - lleve a reporte columna de
 * fecha de cierre" (CP = Cerrada Perdida, CG = Cerrada Ganada).
 *
 * Una oportunidad está cerrada SOLO si su FASE es "Cerrada ganada" o "Cerrada perdida"
 * (ver lib/opportunityPhase.ts); el estado ya no se usa.
 * La tabla no tiene una columna "fecha_cierre" real. Se toma, en este orden:
 *  1. `_sync_metadata.fase_id` (epoch ms del último cambio de fase, lo escribe la app/sync).
 *  2. `_sync_metadata.estado_id` (datos viejos: el mismo momento cuando se cerró por estado).
 *  3. `fecha_cierre_estimada` (en B2C la app la pone en "hoy" al cerrar, y en
 *     los datos migrados trae la fecha de cierre del CRM anterior).
 * Para oportunidades abiertas devuelve null.
 */

import { getPhaseOutcomeByName } from './opportunityPhase';

type PhaseRel = { nombre?: string | null } | Array<{ nombre?: string | null }> | null | undefined;

type CloseDateInput = {
    /** Fase unida (join CRM_FasesOportunidad) */
    fase?: PhaseRel;
    /** Nombre de la fase, si ya viene plano */
    fase_nombre?: string | null;
    fecha_cierre_estimada?: string | null;
    _sync_metadata?: Record<string, unknown> | null;
} | null | undefined;

function phaseNameOf(opp: CloseDateInput): string | null {
    if (!opp) return null;
    if (opp.fase_nombre) return opp.fase_nombre;
    const rel = Array.isArray(opp.fase) ? opp.fase[0] : opp.fase;
    return rel?.nombre ?? null;
}

export function isClosedOpportunity(opp: CloseDateInput): boolean {
    return getPhaseOutcomeByName(phaseNameOf(opp)) !== 'open';
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
    const ts = epochFromMeta(meta, 'fase_id') ?? epochFromMeta(meta, 'estado_id');
    if (ts !== null) return toBogotaDateString(new Date(ts));
    const est = opp.fecha_cierre_estimada;
    if (est && /^\d{4}-\d{2}-\d{2}/.test(est)) return est.slice(0, 10);
    return null;
}
