import type { OutboxItem } from './db';

export const MAX_SYNC_RETRIES = 5;
export const CATALOG_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
export const SYNCING_LEASE_TIMEOUT_MS = 2 * 60 * 1000;

export type SaveStatus =
    | { kind: 'saved'; label: 'Guardado' }
    | { kind: 'pending'; label: 'Pendiente' }
    | { kind: 'attention'; label: 'Requiere atención' };

export function resolveSaveStatus(input: {
    pendingCount: number;
    attentionCount: number;
    error: string | null;
}): SaveStatus {
    if (input.attentionCount > 0 || input.error) {
        return { kind: 'attention', label: 'Requiere atención' };
    }
    if (input.pendingCount > 0) {
        return { kind: 'pending', label: 'Pendiente' };
    }
    return { kind: 'saved', label: 'Guardado' };
}

export function getSyncBackoffDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, Math.max(0, retryCount)), 30000);
}

export function isRetryDue(item: OutboxItem, now = Date.now()): boolean {
    return item.status === 'PENDING' || (
        item.status === 'FAILED' &&
        (item.retry_count || 0) < MAX_SYNC_RETRIES &&
        (item.next_attempt_at || 0) <= now
    );
}

export function isSyncLeaseExpired(item: Pick<OutboxItem, 'last_attempt_at'>, now = Date.now()): boolean {
    return !item.last_attempt_at || item.last_attempt_at < now - SYNCING_LEASE_TIMEOUT_MS;
}

/**
 * Errores de red/infraestructura que no dependen del dato (señal móvil intermitente,
 * llamada entrante, app en segundo plano, token por refrescar, 5xx del gateway).
 * Estos NO deben agotar los reintentos: antes, 5 fallos seguidos (~30 s de backoff)
 * mandaban el cambio a DEAD_LETTER y dejaba de subirse hasta un reintento manual.
 */
const TRANSIENT_SYNC_ERROR_PATTERNS = [
    /failed to fetch/i,
    /fetch failed/i,
    /load failed/i,
    /networkerror/i,
    /network request failed/i,
    /network error/i,
    /timed? ?out/i,
    /aborterror/i,
    /the user aborted a request/i,
    /econnreset|econnrefused|enotfound|etimedout/i,
    /jwt expired/i,
    /\b(502|503|504)\b/,
    /bad gateway|service unavailable|gateway time-?out/i
];

export function isTransientSyncError(error: string | null | undefined): boolean {
    if (!error) return false;
    return TRANSIENT_SYNC_ERROR_PATTERNS.some(pattern => pattern.test(error));
}

export function buildFailureUpdate(
    item: Pick<OutboxItem, 'retry_count'>,
    error: string,
    now = Date.now()
): Pick<OutboxItem, 'status' | 'retry_count' | 'error' | 'last_attempt_at' | 'next_attempt_at'> {
    const attempt = (item.retry_count || 0) + 1;
    // Un error transitorio nunca convierte el cambio en DEAD_LETTER: se sigue
    // reintentando con el backoff máximo hasta que vuelva la conexión.
    const retryCount = isTransientSyncError(error) ? Math.min(attempt, MAX_SYNC_RETRIES - 1) : attempt;
    const isDeadLetter = retryCount >= MAX_SYNC_RETRIES;

    return {
        status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
        retry_count: retryCount,
        error,
        last_attempt_at: now,
        next_attempt_at: isDeadLetter ? undefined : now + getSyncBackoffDelay(retryCount)
    };
}

export function syncCursorId(userId: string, tableName: string): string {
    return `${userId}:${tableName}`;
}

export function shouldRefreshCatalogs(
    refreshedAt: string | null | undefined,
    now = Date.now(),
    ttlMs = CATALOG_REFRESH_TTL_MS
): boolean {
    if (!refreshedAt) return true;
    const timestamp = Date.parse(refreshedAt);
    return !Number.isFinite(timestamp) || now - timestamp >= ttlMs;
}
