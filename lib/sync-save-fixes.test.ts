import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: null } })),
            getSession: vi.fn(async () => ({ data: { session: null } }))
        },
        rpc: vi.fn(),
        from: vi.fn()
    }
}));

import { activateLocalDatabase, db, type OutboxItem } from './db';
import { SyncEngine, mergePendingOutboxValues } from './sync';
import { buildFailureUpdate, isTransientSyncError, MAX_SYNC_RETRIES } from './sync-runtime';

const item = (overrides: Partial<OutboxItem>): OutboxItem => ({
    id: overrides.id || Math.random().toString(36).slice(2),
    entity_type: 'CRM_Oportunidades',
    entity_id: 'opp-1',
    field_name: 'nombre',
    old_value: null,
    new_value: null,
    field_timestamp: 1,
    status: 'PENDING',
    retry_count: 0,
    ...overrides
});

describe('Problemas al guardar: el outbox no pierde cambios', () => {
    let engine: SyncEngine;

    beforeEach(async () => {
        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
        await activateLocalDatabase('test-user');
        db.close();
        await db.delete();
        await db.open();
        engine = new SyncEngine();
    });

    it('mergePendingOutboxValues aplica snapshots y campos en orden cronológico', () => {
        const merged = mergePendingOutboxValues([
            item({ field_name: 'amount', new_value: 500, field_timestamp: 3 }),
            item({ field_name: '_complete_snapshot_', new_value: { nombre: 'A', amount: 100 }, field_timestamp: 1 }),
            item({ field_name: '_sync_metadata', new_value: { x: 1 }, field_timestamp: 4 })
        ]);
        expect(merged).toEqual({ nombre: 'A', amount: 500 });
    });

    it('un snapshot nuevo conserva un cambio de campo pendiente anterior', async () => {
        await engine.queueMutation('CRM_Oportunidades', 'opp-1', { comentarios: 'Llamar el lunes' });
        await engine.queueMutation('CRM_Oportunidades', 'opp-1', { nombre: 'Proyecto Torre 2' }, { isSnapshot: true });

        const items = await db.outbox.toArray();
        expect(items).toHaveLength(1);
        expect(items[0].field_name).toBe('_complete_snapshot_');
        expect(items[0].new_value).toMatchObject({ comentarios: 'Llamar el lunes', nombre: 'Proyecto Torre 2' });
    });

    it('un snapshot parcial no borra campos de un snapshot pendiente anterior', async () => {
        await engine.queueMutation('CRM_Cuentas', 'acc-1', { nombre: 'Cuenta', telefono: '1' }, { isSnapshot: true });
        await engine.queueMutation('CRM_Cuentas', 'acc-1', { email: 'a@b.co' }, { isSnapshot: true });

        const items = await db.outbox.toArray();
        expect(items).toHaveLength(1);
        expect(items[0].new_value).toMatchObject({ nombre: 'Cuenta', telefono: '1', email: 'a@b.co' });
    });

    it('la deduplicación conserva cambios de campo más nuevos que el snapshot', async () => {
        await db.outbox.bulkAdd([
            item({ id: 's1', field_name: '_complete_snapshot_', new_value: { nombre: 'Viejo', amount: 1 }, field_timestamp: 10 }),
            item({ id: 'f1', field_name: 'nombre', new_value: 'Nuevo', field_timestamp: 20 }),
            item({ id: 's0', field_name: '_complete_snapshot_', new_value: { probabilidad: 50 }, field_timestamp: 5 })
        ]);

        await (engine as unknown as { resetStuckItems: () => Promise<void> }).resetStuckItems();

        const items = await db.outbox.toArray();
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('s1');
        expect(items[0].new_value).toEqual({ probabilidad: 50, nombre: 'Nuevo', amount: 1 });
        expect(items[0].field_timestamp).toBe(20);
    });

    it('la deduplicación no toca items en vuelo (SYNCING con lease vigente)', async () => {
        await db.outbox.bulkAdd([
            item({ id: 'inflight', field_name: '_complete_snapshot_', new_value: { nombre: 'A' }, status: 'SYNCING', last_attempt_at: Date.now(), field_timestamp: 1 }),
            item({ id: 'pending', field_name: '_complete_snapshot_', new_value: { nombre: 'B' }, field_timestamp: 2 })
        ]);

        await (engine as unknown as { resetStuckItems: () => Promise<void> }).resetStuckItems();

        const ids = (await db.outbox.toArray()).map(i => i.id).sort();
        expect(ids).toEqual(['inflight', 'pending']);
    });
});

describe('Errores de red transitorios', () => {
    it('reconoce errores de red y de sesión como transitorios', () => {
        expect(isTransientSyncError('TypeError: Failed to fetch')).toBe(true);
        expect(isTransientSyncError('Load failed')).toBe(true);
        expect(isTransientSyncError('JWT expired')).toBe(true);
        expect(isTransientSyncError('503 Service Unavailable')).toBe(true);
        expect(isTransientSyncError('duplicate key value violates unique constraint')).toBe(false);
    });

    it('un error de red repetido no manda el cambio a DEAD_LETTER', () => {
        let state: { retry_count: number } = { retry_count: 0 };
        for (let i = 0; i < MAX_SYNC_RETRIES * 3; i++) {
            const update = buildFailureUpdate(state, 'TypeError: Failed to fetch', 1000);
            expect(update.status).toBe('FAILED');
            state = { retry_count: update.retry_count };
        }
        const permanent = buildFailureUpdate({ retry_count: MAX_SYNC_RETRIES - 1 }, 'violates check constraint', 1000);
        expect(permanent.status).toBe('DEAD_LETTER');
    });
});
