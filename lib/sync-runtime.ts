import type { OutboxItem } from './db';

export const MAX_SYNC_RETRIES = 5;
export const CATALOG_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
export const SYNCING_LEASE_TIMEOUT_MS = 2 * 60 * 1000;

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

export function buildFailureUpdate(
    item: Pick<OutboxItem, 'retry_count'>,
    error: string,
    now = Date.now()
): Pick<OutboxItem, 'status' | 'retry_count' | 'error' | 'last_attempt_at' | 'next_attempt_at'> {
    const retryCount = (item.retry_count || 0) + 1;
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
