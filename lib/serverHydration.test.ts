import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; ops: Array<[string, unknown[]]> };
const calls: Call[] = [];
let responses: Record<string, unknown[]> = {};

function builder(table: string) {
    const call: Call = { table, ops: [] };
    calls.push(call);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock encadenable del cliente de Supabase
    const proxy: any = new Proxy({}, {
        get(_t, prop: string) {
            if (prop === 'then') {
                return (resolve: (v: unknown) => void) => {
                    const range = call.ops.find(([op]) => op === 'range');
                    const rows = responses[table] || [];
                    const data = range ? rows.slice(range[1][0] as number, (range[1][1] as number) + 1) : rows;
                    resolve({ data, error: null });
                };
            }
            return (...args: unknown[]) => { call.ops.push([prop, args]); return proxy; };
        }
    });
    return proxy;
}

vi.mock('./supabase', () => ({
    supabase: {
        from: (table: string) => builder(table),
        auth: {
            getUser: vi.fn(async () => ({ data: { user: null } })),
            getSession: vi.fn(async () => ({ data: { session: null } }))
        }
    }
}));

import { db } from './db';
import { hydrateOpportunityActivities, hydrateActivitiesForSearch } from './serverHydration';
import { accentInsensitiveRegex, accentInsensitiveCondition } from './utils';

const OPP = 'opp-1';
const act = (id: string, extra: Record<string, unknown> = {}) => ({
    id, opportunity_id: OPP, account_id: 'acc-1', user_id: 'seller-1', asunto: `Actividad ${id}`,
    fecha_inicio: '2025-01-01T12:00:00Z', is_completed: true, is_deleted: false, tipo_actividad: 'EVENTO', ...extra
});

describe('accent-insensitive search helpers', () => {
    it('matches accented / ñ data from a normalized token', () => {
        const re = new RegExp(accentInsensitiveRegex('cataluna')!, 'i');
        expect(re.test('HIDROMASAJE CATALUÑA ISLA')).toBe(true);
        expect(new RegExp(accentInsensitiveRegex('Pérez')!, 'i').test('Olga Pérez')).toBe(true);
        expect(new RegExp(accentInsensitiveRegex('pot42202')!, 'i').test('POT42202 - Joswal')).toBe(true);
    });

    it('falls back to ilike for tokens with special characters', () => {
        expect(accentInsensitiveRegex('a.b')).toBeNull();
        expect(accentInsensitiveCondition('nombre', 'a.b')).toBe('nombre.ilike.%a.b%');
        expect(accentInsensitiveCondition('nombre', 'pot1')).toMatch(/^nombre\.imatch\./);
    });
});

describe('serverHydration', () => {
    beforeEach(async () => {
        calls.length = 0;
        responses = {};
        if (!db.isOpen()) await db.open();
        await Promise.all([db.activities.clear(), db.outbox.clear(), db.opportunities.clear(), db.accounts.clear()]);
    });

    it('adds every missing activity of the opportunity without overwriting local or pending ones', async () => {
        responses.CRM_Actividades = Array.from({ length: 25 }, (_, i) => act(`a${i}`));
        await db.activities.add(act('a0', { asunto: 'local edit' }) as unknown as Parameters<typeof db.activities.add>[0]);
        await db.outbox.add({ id: 'o1', entity_type: 'CRM_Actividades', entity_id: 'a1', status: 'PENDING' } as unknown as Parameters<typeof db.outbox.add>[0]);

        const added = await hydrateOpportunityActivities(OPP, { viewerId: 'admin-1', viewerRole: 'ADMIN' });

        expect(added).toBe(23);
        expect(await db.activities.where('opportunity_id').equals(OPP).count()).toBe(24);
        expect((await db.activities.get('a0'))?.asunto).toBe('local edit');
        expect(await db.activities.get('a1')).toBeUndefined();
        const ops = calls[0].ops.map(([op, args]) => `${op}:${args.join('|')}`);
        expect(ops).toContain(`eq:opportunity_id|${OPP}`);
        expect(ops.some(o => o.startsWith('eq:user_id'))).toBe(false);
    });

    it('limits a seller (VENDEDOR) to his own activities', async () => {
        responses.CRM_Actividades = [act('s1')];
        await hydrateOpportunityActivities(OPP, { viewerId: 'seller-1', viewerRole: 'VENDEDOR' });
        const ops = calls[0].ops.map(([op, args]) => `${op}:${args.join('|')}`);
        expect(ops).toContain('eq:user_id|seller-1');
    });

    it('search hydrates matching activities plus their opportunity and account', async () => {
        responses.CRM_Oportunidades = [{ id: OPP, nombre: 'POT42202 - Joswal', account_id: 'acc-1', is_deleted: false }];
        responses.CRM_Cuentas = [{ id: 'acc-1', nombre: 'Joswal', canal_id: 'PROPIO', is_deleted: false }];
        responses.CRM_Actividades = [act('x1'), act('x2')];

        const added = await hydrateActivitiesForSearch('POT42202', { viewerId: 'admin-1', viewerRole: 'ADMIN' });

        expect(added).toBe(2);
        expect(await db.opportunities.get(OPP)).toBeTruthy();
        expect((await db.accounts.get('acc-1'))?.canal_id).toBe('PROPIO');
        const actCall = calls.find(c => c.table === 'CRM_Actividades')!;
        const orArg = String(actCall.ops.find(([op]) => op === 'or')![1][0]);
        expect(orArg).toContain(`opportunity_id.in.(${OPP})`);
    });

    it('does nothing for short or phone searches', async () => {
        expect(await hydrateActivitiesForSearch('po', { viewerId: 'a', viewerRole: 'ADMIN' })).toBe(0);
        expect(await hydrateActivitiesForSearch('3001234567', { viewerId: 'a', viewerRole: 'ADMIN' })).toBe(0);
        expect(calls.length).toBe(0);
    });
});
