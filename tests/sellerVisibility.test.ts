import { describe, it, expect } from 'vitest';
import {
    activitiesVisibleToViewer,
    sellerCanSeeAccount,
    sellerCanSeeOpportunity,
    sellerOpportunityOrFilter,
    sellerAccountOrFilter,
} from '@/lib/sellerVisibility';
import { computeOpportunityActivitySummary } from '@/lib/opportunityActivities';
import { filterOpportunities } from '@/lib/filterUtils';

const ME = 'asesor-1';
const SETTER = 'setter-admin';

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
});
