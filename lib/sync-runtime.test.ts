import { describe, expect, it } from 'vitest';
import {
    MAX_SYNC_RETRIES,
    buildFailureUpdate,
    getSyncBackoffDelay,
    isRetryDue,
    isSyncLeaseExpired,
    shouldRefreshCatalogs,
    syncCursorId
} from './sync-runtime';

describe('sync runtime policy', () => {
    it('backs off failed mutations instead of retrying them immediately', () => {
        const now = 10_000;
        const failed = buildFailureUpdate({ retry_count: 0 }, 'network', now);

        expect(failed.status).toBe('FAILED');
        expect(failed.retry_count).toBe(1);
        expect(failed.next_attempt_at).toBe(now + getSyncBackoffDelay(1));
        expect(isRetryDue({
            id: '1', entity_type: 'CRM_Cuentas', entity_id: 'a', field_name: 'nombre',
            old_value: null, new_value: 'x', field_timestamp: now,
            status: failed.status, retry_count: failed.retry_count,
            next_attempt_at: failed.next_attempt_at
        }, now)).toBe(false);
    });

    it('moves exhausted mutations to a recoverable dead letter state', () => {
        const failed = buildFailureUpdate({ retry_count: MAX_SYNC_RETRIES - 1 }, 'constraint', 20_000);

        expect(failed.status).toBe('DEAD_LETTER');
        expect(failed.retry_count).toBe(MAX_SYNC_RETRIES);
        expect(failed.next_attempt_at).toBeUndefined();
    });

    it('scopes cursors by user and table', () => {
        expect(syncCursorId('user-a', 'CRM_Cuentas')).toBe('user-a:CRM_Cuentas');
        expect(syncCursorId('user-b', 'CRM_Cuentas')).not.toBe(syncCursorId('user-a', 'CRM_Cuentas'));
    });

    it('does not steal an active SYNCING lease from another tab', () => {
        const now = 1_000_000;
        expect(isSyncLeaseExpired({ last_attempt_at: now - 30_000 }, now)).toBe(false);
        expect(isSyncLeaseExpired({ last_attempt_at: now - 180_000 }, now)).toBe(true);
        expect(isSyncLeaseExpired({}, now)).toBe(true);
    });

    it('refreshes catalogs only when missing, invalid or expired', () => {
        const now = Date.parse('2026-08-21T12:00:00.000Z');
        expect(shouldRefreshCatalogs(null, now)).toBe(true);
        expect(shouldRefreshCatalogs('invalid', now)).toBe(true);
        expect(shouldRefreshCatalogs('2026-08-21T11:00:00.000Z', now)).toBe(false);
        expect(shouldRefreshCatalogs('2026-08-20T11:00:00.000Z', now)).toBe(true);
    });
});
