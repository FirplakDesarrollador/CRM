import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { activityEntityHrefs } from './activityModalLinks';
import { sortActivities, splitUpToDateSections } from './activityAgendaSections';
import {
    activityListHref,
    activityModalUrlDecision,
    mergeActivityListSearchParams,
    type ActivityListUrlState,
} from './activityListParams';

const baseState = (overrides: Partial<ActivityListUrlState> = {}): ActivityListUrlState => ({
    view: 'agenda',
    searchQuery: '',
    filterType: '',
    filterClassification: '',
    filterSubclassification: '',
    filterUser: '',
    filterStatus: 'all',
    filterChannel: '',
    filterDateFrom: '',
    filterDateTo: '',
    sortOrder: 'soonest',
    agendaDateMode: 'up_to',
    omitCompleted: true,
    ...overrides,
});

describe('URL del listado de actividades', () => {
    it('el enlace de una fila conserva los filtros y agrega el id de la actividad', () => {
        const href = activityListHref('880292dd-b895-43e3-ba2d-3f2574486c11', 'user=9bca54d7-45d6-4e79-8dba-be6983a78556&status=pending');
        const url = new URL(href, 'http://localhost');
        expect(url.pathname).toBe('/actividades');
        expect(url.searchParams.get('id')).toBe('880292dd-b895-43e3-ba2d-3f2574486c11');
        expect(url.searchParams.get('user')).toBe('9bca54d7-45d6-4e79-8dba-be6983a78556');
        expect(url.searchParams.get('status')).toBe('pending');
    });

    it('la sincronización de filtros mantiene el id abierto aunque la URL capturada todavía no lo tenga', () => {
        const next = mergeActivityListSearchParams(
            new URLSearchParams('user=9bca54d7-45d6-4e79-8dba-be6983a78556'),
            baseState({ filterUser: '9bca54d7-45d6-4e79-8dba-be6983a78556' }),
            'act-1'
        );
        expect(next.get('id')).toBe('act-1');
        expect(next.get('user')).toBe('9bca54d7-45d6-4e79-8dba-be6983a78556');
    });

    it('un deep link conserva su id mientras el modal no lo fija, y cerrar lo quita sin borrar el filtro', () => {
        const kept = mergeActivityListSearchParams(
            new URLSearchParams('user=asesor&id=act-9'),
            baseState({ filterUser: 'asesor' }),
            undefined
        );
        expect(kept.get('id')).toBe('act-9');
        expect(kept.get('user')).toBe('asesor');

        const closed = mergeActivityListSearchParams(
            new URLSearchParams('user=asesor&id=act-9'),
            baseState({ filterUser: 'asesor' }),
            null
        );
        expect(closed.get('id')).toBeNull();
        expect(closed.get('user')).toBe('asesor');
    });

    it('omite de la URL los valores por defecto y escribe vista, orden y modo cuando no lo son', () => {
        const defaults = mergeActivityListSearchParams(
            new URLSearchParams('view=agenda&dateMode=up_to&order=soonest&omitCompleted=true&id=act-1'),
            baseState(),
            undefined
        );
        expect(defaults.get('view')).toBeNull();
        expect(defaults.get('dateMode')).toBeNull();
        expect(defaults.get('order')).toBeNull();
        expect(defaults.get('omitCompleted')).toBeNull();
        expect(defaults.get('id')).toBe('act-1');

        const custom = mergeActivityListSearchParams(
            new URLSearchParams(''),
            baseState({ view: 'month', sortOrder: 'latest', agendaDateMode: 'exact', omitCompleted: false, searchQuery: 'pot' }),
            undefined
        );
        expect(custom.get('view')).toBe('month');
        expect(custom.get('order')).toBe('latest');
        expect(custom.get('dateMode')).toBe('exact');
        expect(custom.get('omitCompleted')).toBe('false');
        expect(custom.get('search')).toBe('pot');
    });

    it('no cierra el modal si la URL pierde el id mientras la actividad sigue fijada', () => {
        expect(activityModalUrlDecision({
            urlId: null,
            pinnedActivityId: 'act-1',
            ignoreStaleUrlId: false,
            lastProcessedUrlId: 'act-1',
            isModalOpen: true,
        })).toBe('keep');
    });

    it('no reabre la actividad que la URL todavía muestra si el usuario acaba de cerrar el modal', () => {
        expect(activityModalUrlDecision({
            urlId: 'act-1',
            pinnedActivityId: null,
            ignoreStaleUrlId: true,
            lastProcessedUrlId: null,
            isModalOpen: false,
        })).toBe('ignore');
    });

    it('no pisa la actividad recién elegida con un id viejo que la URL aún no actualizó', () => {
        expect(activityModalUrlDecision({
            urlId: 'act-vieja',
            pinnedActivityId: 'act-nueva',
            ignoreStaleUrlId: false,
            lastProcessedUrlId: 'act-nueva',
            isModalOpen: true,
        })).toBe('keep');
    });

    it('abre el modal cuando la URL trae un id y el modal sigue cerrado', () => {
        expect(activityModalUrlDecision({
            urlId: 'act-1',
            pinnedActivityId: undefined,
            ignoreStaleUrlId: false,
            lastProcessedUrlId: null,
            isModalOpen: false,
        })).toBe('open');
    });
});

describe('Hasta la fecha: Hoy antes que Atrasadas', () => {
    const today = new Date(2026, 10, 10, 15, 0, 0);

    const overdue = Array.from({ length: 127 }, (_, index) => {
        const date = new Date(2026, 6, 1, 9, 0, 0);
        date.setDate(date.getDate() + index);
        return { id: `old-${index}`, asunto: `Atrasada ${index}`, fecha_inicio: date.toISOString() };
    });

    const hoy = Array.from({ length: 11 }, (_, index) => ({
        id: `hoy-${index}`,
        asunto: `Hoy ${index}`,
        fecha_inicio: new Date(2026, 10, 10, 8 + index, 0, 0).toISOString(),
    }));

    it('con orden próxima, las 11 de hoy salen antes de las 127 atrasadas y no se pierde ninguna', () => {
        const sorted = sortActivities([...overdue, ...hoy], 'soonest');
        expect(sorted.slice(0, 20).every(item => item.id.startsWith('old-'))).toBe(true);

        const sections = splitUpToDateSections(sorted, today, today);
        const flat = sections.flatMap(section => section.items);

        expect(sections.map(section => section.title)).toEqual(['Hoy', 'Atrasadas']);
        expect(flat.slice(0, 11).map(item => item.id)).toEqual(hoy.map(item => item.id));
        expect(flat.filter(item => item.id.startsWith('old-'))).toHaveLength(127);
        expect(flat).toHaveLength(138);
        expect(flat.slice(0, 20).filter(item => item.id.startsWith('hoy-'))).toHaveLength(11);
    });

    it('si la fecha elegida es posterior, Hoy sigue primero y no se esconde lo de en medio', () => {
        const selected = new Date(2026, 10, 12, 12, 0, 0);
        const items = sortActivities([
            { id: 'old', asunto: 'Vieja', fecha_inicio: new Date(2026, 10, 1, 9).toISOString() },
            { id: 'hoy', asunto: 'Hoy', fecha_inicio: new Date(2026, 10, 10, 9).toISOString() },
            { id: 'mid', asunto: 'Media', fecha_inicio: new Date(2026, 10, 11, 9).toISOString() },
            { id: 'dia', asunto: 'Corte', fecha_inicio: new Date(2026, 10, 12, 9).toISOString() },
        ], 'soonest');
        const sections = splitUpToDateSections(items, selected, today);
        expect(sections.map(section => section.id)).toEqual(['hoy', 'dia', 'programadas', 'atrasadas']);
        expect(sections.map(section => section.items.map(item => item.id))).toEqual([['hoy'], ['dia'], ['mid'], ['old']]);
    });

    it('mantiene el orden reciente dentro de cada bloque', () => {
        const sorted = sortActivities([...overdue, ...hoy], 'latest');
        const sections = splitUpToDateSections(sorted, today, today);
        expect(sections[0].items.map(item => item.id)).toEqual([...hoy].reverse().map(item => item.id));
        expect(sections[1].items[0].id).toBe('old-126');
    });
});

describe('Accesos del modal de actividad', () => {
    it('arma los enlaces con los ids aunque la cuenta y la oportunidad no estén en la copia local', () => {
        expect(activityEntityHrefs({
            accountId: 'acc-1',
            opportunityId: 'opp-1',
        })).toEqual({
            accountHref: '/cuentas?id=acc-1',
            opportunityHref: '/oportunidades/opp-1',
        });
    });

    it('muestra solo el acceso cuyo id existe', () => {
        expect(activityEntityHrefs({ accountId: '', opportunityId: 'opp-1' })).toEqual({
            accountHref: null,
            opportunityHref: '/oportunidades/opp-1',
        });
        expect(activityEntityHrefs({ accountId: null, opportunityId: null })).toEqual({
            accountHref: null,
            opportunityHref: null,
        });
    });

    it('la página y el modal usan esos helpers y ya no dependen de un href pelado', () => {
        const page = readFileSync(path.join(process.cwd(), 'app/actividades/page.tsx'), 'utf8');
        const modal = readFileSync(path.join(process.cwd(), 'components/activities/CreateActivityModal.tsx'), 'utf8');
        expect(page).toContain('activityListHref');
        expect(page).not.toContain('href={`/actividades?id=${act.id}`}');
        expect(page).toContain('splitUpToDateSections');
        expect(modal).toContain('activityEntityHrefs');
        expect(modal).toContain('Ir a la cuenta');
        expect(modal).toContain('Ir a la oportunidad');
    });
});
