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

import { activateLocalDatabase, db } from './db';
import { SyncEngine } from './sync';
import { supabase } from './supabase';

interface RpcUpdate {
    mutation_id: string;
    id: string;
    field: string;
}

interface RpcArguments {
    p_updates: RpcUpdate[];
}

describe('SyncEngine outbox invariants', () => {
    let engine: SyncEngine;

    beforeEach(async () => {
        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
        await activateLocalDatabase('test-user');
        db.close();
        await db.delete();
        await db.open();
        engine = new SyncEngine();
    });

    it('rolls back the local entity when writing its outbox mutation fails', async () => {
        vi.spyOn(db.outbox, 'add').mockRejectedValueOnce(new Error('outbox unavailable'));

        await expect(engine.commitLocalChanges([db.accounts], async () => {
            const account = { id: 'atomic-account', nombre: 'Atómica', nit: '1', canal_id: 'PROPIO' };
            await db.accounts.add(account);
            return [{
                entityTable: 'CRM_Cuentas',
                entityId: account.id,
                changes: account,
                options: { isSnapshot: true }
            }];
        })).rejects.toThrow('outbox unavailable');

        expect(await db.accounts.get('atomic-account')).toBeUndefined();
        expect(await db.outbox.count()).toBe(0);
    });

    it('keeps one latest snapshot under concurrent autosaves', async () => {
        await Promise.all(Array.from({ length: 20 }, (_, index) =>
            engine.queueMutation('CRM_Cuentas', 'account-1', { nombre: `Version ${index}` }, { isSnapshot: true })
        ));

        const items = await db.outbox.toArray();
        expect(items).toHaveLength(1);
        expect(items[0].field_name).toBe('_complete_snapshot_');
        expect(items[0].new_value.nombre).toMatch(/^Version \d+$/);
        expect(items[0].status).toBe('PENDING');
        expect(items[0].retry_count).toBe(0);
    });

    it('revives a dead letter when the user edits the entity again', async () => {
        await db.outbox.add({
            id: 'dead-1',
            entity_type: 'CRM_Cuentas',
            entity_id: 'account-1',
            field_name: '_complete_snapshot_',
            old_value: null,
            new_value: { nombre: 'Old' },
            field_timestamp: 1,
            status: 'DEAD_LETTER',
            retry_count: 5,
            error: 'constraint'
        });

        await engine.queueMutation('CRM_Cuentas', 'account-1', { nombre: 'Corrected' }, { isSnapshot: true });

        const item = await db.outbox.get('dead-1');
        expect(item).toMatchObject({
            status: 'PENDING',
            retry_count: 0,
            new_value: { nombre: 'Corrected' }
        });
        expect(item?.error).toBeUndefined();
    });

    it('merges a field mutation into an existing snapshot instead of losing it during compaction', async () => {
        await engine.queueMutation('CRM_Cuentas', 'account-1', { nombre: 'Cuenta', telefono: '1' }, { isSnapshot: true });
        await engine.queueMutation('CRM_Cuentas', 'account-1', { telefono: '2' });

        const items = await db.outbox.toArray();
        expect(items).toHaveLength(1);
        expect(items[0].new_value).toEqual({ nombre: 'Cuenta', telefono: '2' });
    });

    it('makes dead letters explicitly recoverable', async () => {
        await db.outbox.bulkAdd(['a', 'b'].map(id => ({
            id,
            entity_type: 'CRM_Cuentas',
            entity_id: id,
            field_name: 'nombre',
            old_value: null,
            new_value: id,
            field_timestamp: 1,
            status: 'DEAD_LETTER' as const,
            retry_count: 5,
            error: 'network'
        })));

        await expect(engine.retryDeadLetters()).resolves.toBe(2);
        const recovered = await db.outbox.toArray();
        expect(recovered.every(item => item.status === 'PENDING' && item.retry_count === 0)).toBe(true);
    });

    it('pushes one account edit without issuing any table pull', async () => {
        await engine.queueMutation('CRM_Cuentas', 'account-1', { nombre: 'Nueva' }, { isSnapshot: true });
        const queued = await db.outbox.toArray();

        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
        vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'test-user' } } } as never);
        vi.mocked(supabase.rpc).mockImplementation((async (_name: string, args: RpcArguments) => ({
            data: args.p_updates.map((update) => ({
                mutation_id: update.mutation_id,
                id: update.id,
                field: update.field,
                success: true,
                message: 'Updated'
            })),
            error: null
        })) as never);

        await engine.triggerPush();

        expect(queued).toHaveLength(1);
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.from).not.toHaveBeenCalled();
        expect(await db.outbox.count()).toBe(0);

        const run = await db.syncRuns.orderBy('started_at').last();
        expect(run).toMatchObject({
            kind: 'PUSH',
            trigger: 'unspecified',
            status: 'COMPLETED',
            pending_before: 1,
            pending_after: 0
        });
        expect(run?.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('retries with the same mutation identity instead of creating a duplicate operation', async () => {
        await engine.queueMutation('CRM_Cuentas', 'account-retry', { nombre: 'Una sola vez' }, { isSnapshot: true });
        const mutationId = (await db.outbox.toArray())[0].id;

        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
        vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'test-user' } } } as never);
        vi.mocked(supabase.rpc)
            .mockResolvedValueOnce({ data: null, error: { message: 'network' } } as never)
            .mockImplementationOnce((async (_name: string, args: RpcArguments) => ({
                data: args.p_updates.map((update) => ({
                    mutation_id: update.mutation_id,
                    id: update.id,
                    field: update.field,
                    success: true,
                    message: 'Updated'
                })),
                error: null
            })) as never);

        await engine.triggerPush('first-attempt');
        await db.outbox.update(mutationId, { next_attempt_at: 0 });
        await engine.triggerPush('retry-attempt');

        const rpcCalls = vi.mocked(supabase.rpc).mock.calls as unknown as Array<[string, RpcArguments]>;
        const sentMutationIds = rpcCalls.flatMap(([, args]) =>
            args.p_updates
                .filter((update) => update.id === 'account-retry')
                .map((update) => update.mutation_id)
        );
        expect(sentMutationIds).toEqual([mutationId, mutationId]);
        expect(await db.outbox.count()).toBe(0);
    });
});
