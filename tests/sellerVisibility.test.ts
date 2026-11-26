import { describe, it, expect } from 'vitest';
import {
    activitiesVisibleToViewer,
    canViewAllAccountsContactsOpportunities,
    sellerCanSeeAccount,
    sellerCanSeeOpportunity,
    sellerCanSeeActivity,
    sellerOpportunityOrFilter,
    sellerAccountOrFilter,
    shouldShowActivityNotification,
} from '@/lib/sellerVisibility';
import { canViewAllAccountsContactsOpportunities as canViewAllFromPermissions, hasPermission } from '@/lib/permissions';
import { computeOpportunityActivitySummary } from '@/lib/opportunityActivities';
import { filterAccounts, filterActivities, filterContacts, filterOpportunities } from '@/lib/filterUtils';
import { needsFullPortfolioPull, portfolioBootstrapLimit } from '@/lib/sync-runtime';

const ME = 'asesor-1';
const SETTER = 'setter-admin';
const COTIZACIONES_ID = '1870c27f-e901-41ed-97d4-7ecc89fd4935';
const COTIZACIONES_EMAIL = 'cotizaciones@firplak.co';

describe('sellerVisibility', () => {
    it('oportunidad: solo dueño o colaborador (no creador)', () => {
        const collab = new Set(['opp-collab']);
        expect(sellerCanSeeOpportunity({ id: 'o1', owner_user_id: ME }, ME, collab)).toBe(true);
        expect(sellerCanSeeOpportunity({ id: 'opp-collab', owner_user_id: 'otro' }, ME, collab)).toBe(true);
        expect(sellerCanSeeOpportunity({ id: 'o2', owner_user_id: 'otro' }, ME, collab)).toBe(false);
    });

    it('cuenta: dueño, sin dueño y creada por él, o colaborador', () => {
        const collab = new Set(['acc-collab']);
        expect(sellerCanSeeAccount({ id: 'a1', owner_user_id: ME }, ME, collab)).toBe(true);
        expect(sellerCanSeeAccount({ id: 'a2', owner_user_id: null, created_by: ME }, ME, collab)).toBe(true);
        expect(sellerCanSeeAccount({ id: 'a3', owner_user_id: 'otro', created_by: ME }, ME, collab)).toBe(false);
        expect(sellerCanSeeAccount({ id: 'acc-collab', owner_user_id: 'otro' }, ME, collab)).toBe(true);
    });

    it('filtros PostgREST', () => {
        expect(sellerOpportunityOrFilter(ME, [])).toBe(`owner_user_id.eq.${ME}`);
        expect(sellerOpportunityOrFilter(ME, ['x', 'x', 'y'])).toBe(`owner_user_id.eq.${ME},id.in.(x,y)`);
        expect(sellerAccountOrFilter(ME, [])).toBe(`owner_user_id.eq.${ME},and(owner_user_id.is.null,created_by.eq.${ME})`);
    });

    it('actividades del setter no cuentan para el asesor: "Sin actividad"', () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        const acts = [{ id: 'a', user_id: SETTER, fecha_inicio: future, fecha_fin: future, is_completed: false }];
        const forSeller = computeOpportunityActivitySummary(activitiesVisibleToViewer(acts, 'VENDEDOR', ME));
        expect(forSeller.status).toBe('none');
        expect(forSeller.label).toBe('Sin actividad');
        const forAdmin = computeOpportunityActivitySummary(activitiesVisibleToViewer(acts, 'ADMIN', ME));
        expect(forAdmin.status).toBe('scheduled');
        expect(forAdmin.label).toBe('1 programada');
    });

    it('actividades propias del asesor sí cuentan', () => {
        const past = new Date(Date.now() - 86400000).toISOString();
        const acts = [
            { id: 'a', user_id: ME, fecha_inicio: past, fecha_fin: past, is_completed: false },
            { id: 'b', user_id: SETTER, fecha_inicio: past, fecha_fin: past, is_completed: false },
        ];
        const s = computeOpportunityActivitySummary(activitiesVisibleToViewer(acts, 'VENDEDOR', ME));
        expect(s.overdue).toBe(1);
        expect(s.label).toBe('1 atrasada');
    });

    it('filterOpportunities: el asesor no ve lo que creó para otro ni en "unrestricted"/"web"', () => {
        const opps = [
            { id: 'mia', owner_user_id: ME, created_by: SETTER, origen_oportunidad: 'Web' },
            { id: 'creada-para-otro', owner_user_id: 'otro', created_by: ME, origen_oportunidad: 'Web' },
            { id: 'web-ajena', owner_user_id: 'otro', created_by: 'otro', origen_oportunidad: 'Pagina web' },
        ] as unknown as Parameters<typeof filterOpportunities>[0];
        for (const userFilter of ['all', 'unrestricted', 'web', 'mine'] as const) {
            const res = filterOpportunities(opps, { userFilter }, { currentUserId: ME, userRole: 'VENDEDOR' });
            expect(res.map(o => o.id)).toEqual(['mia']);
        }
        const admin = filterOpportunities(opps, { userFilter: 'web' }, { currentUserId: 'adm', userRole: 'ADMIN' });
        expect(admin).toHaveLength(3);
    });

    it('notificaciones de actividad vencida: un asesor NO ve las del setter ni de otros usuarios', () => {
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', SETTER, 'VENDEDOR', ME)).toBe(false);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', ME, 'VENDEDOR', ME)).toBe(true);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', SETTER, 'ADMIN', ME)).toBe(true);
        expect(shouldShowActivityNotification('NEW_OPPORTUNITY', SETTER, 'VENDEDOR', ME)).toBe(true);
    });

    it('actividades asignadas a un setter no son visibles para el asesor aunque la oportunidad sea de él', () => {
        const setterAct = { id: 'act-setter-1', user_id: SETTER, is_completed: false };
        const myAct = { id: 'act-me-1', user_id: ME, is_completed: false };
        expect(sellerCanSeeActivity(setterAct, ME)).toBe(false);
        expect(sellerCanSeeActivity(myAct, ME)).toBe(true);

        const list = activitiesVisibleToViewer([setterAct, myAct], 'VENDEDOR', ME);
        expect(list).toEqual([myAct]);
    });

    it('cotizaciones ve toda la cartera y sigue siendo VENDEDOR en actividades y permisos de admin', () => {
        expect(canViewAllAccountsContactsOpportunities({ id: COTIZACIONES_ID, email: 'otro@firplak.co' })).toBe(true);
        expect(canViewAllAccountsContactsOpportunities({ id: 'otro-id', email: 'Cotizaciones@Firplak.co' })).toBe(true);
        expect(canViewAllAccountsContactsOpportunities({ id: ME, email: 'asesor@firplak.co' })).toBe(false);
        expect(canViewAllAccountsContactsOpportunities(null)).toBe(false);
        expect(canViewAllFromPermissions).toBe(canViewAllAccountsContactsOpportunities);

        expect(hasPermission('VENDEDOR', 'view_all_opportunities')).toBe(false);
        expect(hasPermission('VENDEDOR', 'view_all_activities')).toBe(false);
        expect(hasPermission('VENDEDOR', 'manage_users')).toBe(false);
        expect(hasPermission('VENDEDOR', 'delete_account')).toBe(false);
        expect(hasPermission('VENDEDOR', 'delete_opportunity')).toBe(false);
        expect(hasPermission('VENDEDOR', 'manage_commission_rules')).toBe(false);
        expect(hasPermission('VENDEDOR', 'edit_quote')).toBe(true);

        const opps = [
            { id: 'mia', owner_user_id: COTIZACIONES_ID, created_by: SETTER, origen_oportunidad: 'Referido' },
            { id: 'ajena', owner_user_id: 'otro', created_by: 'otro', origen_oportunidad: 'Web' },
        ] as unknown as Parameters<typeof filterOpportunities>[0];
        const cotizaciones = {
            currentUserId: COTIZACIONES_ID,
            currentUserEmail: COTIZACIONES_EMAIL,
            userRole: 'VENDEDOR' as const,
        };
        expect(filterOpportunities(opps, { userFilter: 'all' }, cotizaciones).map(o => o.id).sort()).toEqual(['ajena', 'mia']);
        expect(filterOpportunities(opps, { userFilter: 'unrestricted' }, cotizaciones).map(o => o.id).sort()).toEqual(['ajena', 'mia']);
        expect(filterOpportunities(opps, { userFilter: 'web' }, cotizaciones).map(o => o.id)).toEqual(['ajena']);
        expect(filterOpportunities(opps, { userFilter: 'mine' }, cotizaciones).map(o => o.id)).toEqual(['mia']);

        const otroAsesor = filterOpportunities(opps, { userFilter: 'all' }, { currentUserId: ME, userRole: 'VENDEDOR' });
        expect(otroAsesor.map(o => o.id)).toEqual([]);

        const accounts = [
            { id: 'propia', owner_user_id: COTIZACIONES_ID },
            { id: 'ajena', owner_user_id: 'otro' },
        ] as unknown as Parameters<typeof filterAccounts>[0];
        expect(filterAccounts(accounts, {}, cotizaciones).map(a => a.id).sort()).toEqual(['ajena', 'propia']);
        expect(filterAccounts(accounts, {}, { currentUserId: ME, userRole: 'VENDEDOR' }).map(a => a.id)).toEqual([]);

        const contacts = [
            { id: 'c1', account_id: 'propia', nombre: 'Ana' },
            { id: 'c2', account_id: 'ajena', nombre: 'Luis' },
        ] as unknown as Parameters<typeof filterContacts>[0];
        const allContacts = filterContacts(contacts, {}, {
            ...cotizaciones,
            allowedAccountIds: new Set(['propia']),
        });
        expect(allContacts.map(c => c.id).sort()).toEqual(['c1', 'c2']);
        const sellerContacts = filterContacts(contacts, {}, {
            currentUserId: ME,
            userRole: 'VENDEDOR',
            allowedAccountIds: new Set(['propia']),
        });
        expect(sellerContacts.map(c => c.id)).toEqual(['c1']);

        const acts = [
            { id: 'suya', user_id: COTIZACIONES_ID },
            { id: 'ajena', user_id: SETTER },
        ];
        expect(activitiesVisibleToViewer(acts, 'VENDEDOR', COTIZACIONES_ID).map(a => a.id).sort()).toEqual(['ajena', 'suya']);
        expect(activitiesVisibleToViewer(acts, 'VENDEDOR', ME).map(a => a.id)).toEqual([]);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', SETTER, 'VENDEDOR', COTIZACIONES_ID)).toBe(true);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', SETTER, 'VENDEDOR', ME)).toBe(false);

        const visibleActivities = filterActivities(acts.map(a => ({
            ...a,
            fecha_inicio: new Date().toISOString(),
        })), {}, { currentUserId: COTIZACIONES_ID, canViewAll: false });
        expect(visibleActivities.map(a => a.id).sort()).toEqual(['ajena', 'suya']);
        const sellerActivities = filterActivities(acts.map(a => ({
            ...a,
            fecha_inicio: new Date().toISOString(),
        })), {}, { currentUserId: ME, canViewAll: false });
        expect(sellerActivities.map(a => a.id)).toEqual([]);

        expect(portfolioBootstrapLimit({ id: COTIZACIONES_ID, email: COTIZACIONES_EMAIL })).toBe(Number.POSITIVE_INFINITY);
        expect(portfolioBootstrapLimit({ id: ME, email: 'asesor@firplak.co' })).toBe(3000);
        expect(needsFullPortfolioPull({ id: COTIZACIONES_ID }, null)).toBe(true);
        expect(needsFullPortfolioPull({ id: COTIZACIONES_ID }, '2026-01-01T00:00:00.000Z')).toBe(false);
        expect(needsFullPortfolioPull({ id: ME }, null)).toBe(false);
    });
});
