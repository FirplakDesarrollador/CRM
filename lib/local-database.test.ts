import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: null } })),
            getSession: vi.fn(async () => ({ data: { session: null } }))
        }
    }
}));
import {
    CRMFirplakDB,
    activateLocalDatabase,
    db,
    deactivateLocalDatabase,
    getActiveLocalUserId,
    localDatabaseNameForUser
} from './db';

const USERS = ['user-a', 'user-b'];

async function deleteTestDatabases() {
    await deactivateLocalDatabase();
    db.close();
    await Promise.all([
        Dexie.delete('CRMFirplakDB'),
        Dexie.delete(localDatabaseNameForUser(null)),
        ...USERS.map((userId) => Dexie.delete(localDatabaseNameForUser(userId)))
    ]);
}

describe('local database user isolation', () => {
    beforeEach(deleteTestDatabases);
    afterEach(deleteTestDatabases);

    it('assigns legacy data once and never exposes it to another user', async () => {
        const legacy = new CRMFirplakDB('CRMFirplakDB');
        await legacy.open();
        await legacy.accounts.add({ id: 'account-a', nombre: 'Cuenta A', nit: '1', canal_id: 'PROPIO' });
        await legacy.outbox.add({
            id: 'mutation-a', entity_type: 'CRM_Cuentas', entity_id: 'account-a',
            field_name: '_complete_snapshot_', old_value: null, new_value: { nombre: 'Cuenta A' },
            field_timestamp: 1, status: 'PENDING', retry_count: 0
        });
        await legacy.syncCursors.add({
            id: 'user-b:CRM_Cuentas', user_id: 'user-b', table_name: 'CRM_Cuentas',
            cursor: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
        });
        legacy.close();

        await activateLocalDatabase('user-a');
        expect(getActiveLocalUserId()).toBe('user-a');
        expect(await db.accounts.get('account-a')).toBeDefined();
        expect((await db.outbox.get('mutation-a'))?.user_id).toBe('user-a');
        expect(await db.syncCursors.where('user_id').equals('user-b').count()).toBe(0);

        await activateLocalDatabase('user-b');
        expect(await db.accounts.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);

        await activateLocalDatabase('user-a');
        expect(await db.accounts.get('account-a')).toBeDefined();
        expect(await db.outbox.get('mutation-a')).toBeDefined();
    });

    it('keeps a pending queue after closing and reopening the user database', async () => {
        await activateLocalDatabase('user-a');
        await db.outbox.add({
            id: 'persistent-mutation', entity_type: 'CRM_Cuentas', entity_id: 'account-a',
            field_name: 'nombre', old_value: null, new_value: 'Persistente', user_id: 'user-a',
            field_timestamp: 1, status: 'PENDING', retry_count: 0
        });

        await deactivateLocalDatabase();
        await activateLocalDatabase('user-a');

        expect(await db.outbox.get('persistent-mutation')).toMatchObject({
            status: 'PENDING',
            user_id: 'user-a'
        });
    });
});
