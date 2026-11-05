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
    localDatabaseNameForUser,
    onDatabaseChange,
    getActiveDatabaseVersion
} from './db';

const TEST_USERS = ['user-reactivity-1'];

async function deleteTestDatabases() {
    await deactivateLocalDatabase();
    await Promise.all([
        Dexie.delete('CRMFirplakDB'),
        Dexie.delete(localDatabaseNameForUser(null)),
        ...TEST_USERS.map((userId) => Dexie.delete(localDatabaseNameForUser(userId)))
    ]);
    if (!db.isOpen()) {
        await db.open();
    }
}

describe('database activation reactivity', () => {
    beforeEach(deleteTestDatabases);
    afterEach(deleteTestDatabases);

    it('notifies listeners when database switches from anonymous to authenticated user', async () => {
        expect(getActiveLocalUserId()).toBeNull();
        const initialVersion = getActiveDatabaseVersion();

        const changes: Array<{ userId: string | null; version: number }> = [];
        const unsubscribe = onDatabaseChange((userId) => {
            changes.push({ userId, version: getActiveDatabaseVersion() });
        });

        await activateLocalDatabase('user-reactivity-1');

        expect(changes.length).toBe(1);
        expect(changes[0].userId).toBe('user-reactivity-1');
        expect(changes[0].version).toBeGreaterThan(initialVersion);

        await deactivateLocalDatabase();

        expect(changes.length).toBe(2);
        expect(changes[1].userId).toBeNull();

        unsubscribe();
    });

    it('switches database targets so activities stored in user DB are accessible after activation', async () => {
        // Pre-populate user database directly
        const userDb = new CRMFirplakDB(localDatabaseNameForUser('user-reactivity-1'));
        await userDb.open();
        await userDb.activities.add({
            id: 'act-1',
            asunto: 'Reunión Reactiva',
            fecha_inicio: '2026-10-02T10:00:00Z',
            tipo_actividad: 'EVENTO',
            is_completed: false,
            user_id: 'user-reactivity-1'
        });
        userDb.close();

        // While anonymous, activities are empty
        expect(await db.activities.count()).toBe(0);

        // Activate user DB
        await activateLocalDatabase('user-reactivity-1');

        // After activation, activities from the user DB are available via the proxy db
        expect(await db.activities.count()).toBe(1);
        const act = await db.activities.get('act-1');
        expect(act?.asunto).toBe('Reunión Reactiva');
    });
});
