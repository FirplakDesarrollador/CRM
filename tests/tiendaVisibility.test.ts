import { describe, expect, it } from 'vitest';
import { activitiesVisibleToViewer, shouldShowActivityNotification } from '@/lib/sellerVisibility';
import { filterAccounts, filterOpportunities } from '@/lib/filterUtils';
import {
    canChooseOtherPortfolioUsers,
    filterSearchResultsForTienda,
    isMissingTiendaColumnError,
    isTiendaUser,
    localIdsOutsideTiendaScope,
    needsTiendaFullAccountPull,
    shouldScopeAccountsByRole,
    readEsTiendaFlag,
    restrictActivitiesToTienda,
    restrictPortfolioToTienda,
} from '@/lib/tiendaVisibility';

const ME = '76c2d61b-7023-42d8-bea9-b1905d1f5159';
const OTHER = 'otro-coordinador';
const TIENDA = { id: ME, es_tienda: true as const };
const COORD = { id: OTHER, es_tienda: false as const };

describe('tiendaVisibility', () => {
    it('solo es tienda cuando el perfil trae es_tienda en true', () => {
        expect(isTiendaUser({ es_tienda: true })).toBe(true);
        expect(isTiendaUser({ es_tienda: false })).toBe(false);
        expect(isTiendaUser({})).toBe(false);
        expect(isTiendaUser(null)).toBe(false);
        expect(isTiendaUser({ es_tienda: undefined })).toBe(false);
    });

    it('si la columna aún no existe, la lectura no rompe y no restringe', async () => {
        expect(isMissingTiendaColumnError({ code: '42703', message: 'column CRM_Usuarios.es_tienda does not exist' })).toBe(true);
        expect(isMissingTiendaColumnError({ code: 'PGRST204', message: "Could not find the 'es_tienda' column of 'CRM_Usuarios' in the schema cache" })).toBe(true);
        expect(isMissingTiendaColumnError({ code: '42501', message: 'permission denied' })).toBe(false);

        await expect(readEsTiendaFlag(async () => ({
            data: null,
            error: { code: 'PGRST204', message: "Could not find the 'es_tienda' column of 'CRM_Usuarios' in the schema cache" },
        }))).resolves.toBe(false);
        await expect(readEsTiendaFlag(async () => ({ data: { es_tienda: true }, error: null }))).resolves.toBe(true);
    });

    it('oportunidades: solo las que posee, aunque sea coordinador y colabore o las haya creado', () => {
        const rows = [
            { id: 'mia', owner_user_id: ME, created_by: OTHER },
            { id: 'creada-para-otro', owner_user_id: OTHER, created_by: ME },
            { id: 'subordinado', owner_user_id: 'vendedor-1', created_by: 'vendedor-1' },
            { id: 'colab', owner_user_id: OTHER, created_by: OTHER },
        ];
        expect(restrictPortfolioToTienda(rows, TIENDA).map(row => row.id)).toEqual(['mia']);
        expect(restrictPortfolioToTienda(rows, COORD).map(row => row.id)).toEqual(rows.map(row => row.id));
        expect(restrictPortfolioToTienda(rows, { id: ME }).map(row => row.id)).toEqual(rows.map(row => row.id));
    });

    it('actividades: solo user_id propio; created_by no alcanza', () => {
        const rows = [
            { id: 'mia', user_id: ME, created_by: OTHER },
            { id: 'creada', user_id: OTHER, created_by: ME },
            { id: 'ajena', user_id: OTHER, created_by: OTHER },
        ];
        expect(restrictActivitiesToTienda(rows, TIENDA).map(row => row.id)).toEqual(['mia']);
        expect(restrictActivitiesToTienda(rows, { id: OTHER, es_tienda: false }).map(row => row.id)).toHaveLength(3);
    });

    it('cuentas no se recortan y el selector de otros usuarios se cierra', () => {
        expect(canChooseOtherPortfolioUsers(TIENDA)).toBe(false);
        expect(canChooseOtherPortfolioUsers(COORD)).toBe(true);
        expect(canChooseOtherPortfolioUsers({ id: 'vendedor', es_tienda: false })).toBe(true);
        const search = [
            { entity_type: 'account', id: 'acc-ajena' },
            { entity_type: 'contact', id: 'con-1' },
            { entity_type: 'opportunity', id: 'mia' },
            { entity_type: 'opportunity', id: 'ajena' },
        ];
        expect(filterSearchResultsForTienda(search, TIENDA, new Set(['mia'])).map(row => row.id)).toEqual(['acc-ajena', 'con-1', 'mia']);
        expect(filterSearchResultsForTienda(search, COORD, new Set()).map(row => row.id)).toEqual(search.map(row => row.id));
    });

    it('la caché local suelta oportunidades y actividades ajenas, y conserva lo pendiente', () => {
        const rows = [
            { id: 'mia', owner_user_id: ME, user_id: ME },
            { id: 'ajena', owner_user_id: OTHER, user_id: OTHER },
            { id: 'pendiente', owner_user_id: OTHER, user_id: OTHER },
        ];
        expect(localIdsOutsideTiendaScope(rows, 'owner_user_id', ME, new Set(['pendiente']))).toEqual(['ajena']);
        expect(localIdsOutsideTiendaScope(rows, 'user_id', ME, new Set())).toEqual(['ajena', 'pendiente']);
    });

    it('el listado de actividades de un coordinador de tienda no muestra las del equipo', () => {
        const acts = [
            { id: 'mia', user_id: ME },
            { id: 'equipo', user_id: OTHER },
        ];
        expect(activitiesVisibleToViewer(acts, 'COORDINADOR', ME, TIENDA).map(act => act.id)).toEqual(['mia']);
        expect(activitiesVisibleToViewer(acts, 'COORDINADOR', OTHER).map(act => act.id)).toEqual(['mia', 'equipo']);
        expect(activitiesVisibleToViewer(acts, 'ADMIN', 'admin-1').map(act => act.id)).toEqual(['mia', 'equipo']);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', OTHER, 'COORDINADOR', ME, TIENDA)).toBe(false);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', ME, 'COORDINADOR', ME, TIENDA)).toBe(true);
        expect(shouldShowActivityNotification('ACTIVITY_OVERDUE', OTHER, 'COORDINADOR', OTHER)).toBe(true);
    });

    it('un vendedor de tienda ve todas las cuentas; un vendedor sin bandera no', () => {
        const accounts = [
            { id: 'propia', owner_user_id: ME },
            { id: 'ajena', owner_user_id: OTHER },
        ] as unknown as Parameters<typeof filterAccounts>[0];

        expect(shouldScopeAccountsByRole({ id: ME, es_tienda: true }, 'VENDEDOR')).toBe(false);
        expect(shouldScopeAccountsByRole({ id: ME, es_tienda: false }, 'VENDEDOR')).toBe(true);
        expect(shouldScopeAccountsByRole({ id: OTHER }, 'COORDINADOR')).toBe(true);
        expect(shouldScopeAccountsByRole({ id: OTHER, es_tienda: true }, 'COORDINADOR')).toBe(false);
        expect(shouldScopeAccountsByRole({ id: 'admin-1' }, 'ADMIN')).toBe(false);

        expect(filterAccounts(accounts, {}, {
            currentUserId: ME,
            userRole: 'VENDEDOR',
            esTienda: true,
        }).map(account => account.id).sort()).toEqual(['ajena', 'propia']);
        expect(filterAccounts(accounts, {}, {
            currentUserId: ME,
            userRole: 'VENDEDOR',
        }).map(account => account.id)).toEqual(['propia']);

        expect(needsTiendaFullAccountPull({ es_tienda: true }, null)).toBe(true);
        expect(needsTiendaFullAccountPull({ es_tienda: true }, '2026-11-26T00:00:00.000Z')).toBe(false);
        expect(needsTiendaFullAccountPull({ es_tienda: false }, null)).toBe(false);
    });

    it('filterOpportunities de un coordinador sin bandera sigue viendo el equipo y la web ajena', () => {
        const opps = [
            { id: 'mia', owner_user_id: OTHER, created_by: OTHER, origen_oportunidad: 'Web' },
            { id: 'equipo', owner_user_id: 'vendedor-1', created_by: 'vendedor-1', origen_oportunidad: 'Web' },
        ] as unknown as Parameters<typeof filterOpportunities>[0];
        const visible = filterOpportunities(opps, { userFilter: 'all' }, {
            currentUserId: OTHER,
            userRole: 'COORDINADOR',
            subordinateIds: ['vendedor-1'],
        });
        expect(visible.map(opp => opp.id).sort()).toEqual(['equipo', 'mia']);
    });
});
