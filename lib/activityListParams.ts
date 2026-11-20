export interface ActivityListUrlState {
    view: 'agenda' | 'month' | 'all';
    searchQuery: string;
    filterType: string;
    filterClassification: string;
    filterSubclassification: string;
    filterUser: string;
    filterStatus: 'all' | 'completed' | 'pending' | 'overdue';
    filterChannel: string;
    filterDateFrom: string;
    filterDateTo: string;
    sortOrder: 'soonest' | 'latest' | 'title' | 'title_desc';
    agendaDateMode: 'up_to' | 'exact';
    omitCompleted: boolean;
}

/**
 * Arma la query del listado.
 * `pinnedActivityId`:
 * - string: la actividad que el modal tiene abierta (sobrevive a un replace atrasado)
 * - null: el usuario cerró el modal; hay que quitar `id`
 * - undefined: no tocar el `id` que ya venga (deep link todavía no adoptado)
 */
export function mergeActivityListSearchParams(
    current: URLSearchParams,
    state: ActivityListUrlState,
    pinnedActivityId: string | null | undefined
): URLSearchParams {
    const params = new URLSearchParams(current.toString());

    if (state.view !== 'agenda') params.set('view', state.view);
    else params.delete('view');

    if (state.searchQuery) params.set('search', state.searchQuery);
    else params.delete('search');

    if (state.filterType) params.set('type', state.filterType);
    else params.delete('type');

    if (state.filterClassification) params.set('classification', state.filterClassification);
    else params.delete('classification');

    if (state.filterSubclassification) params.set('subclassification', state.filterSubclassification);
    else params.delete('subclassification');

    if (state.filterUser) params.set('user', state.filterUser);
    else params.delete('user');

    if (state.filterStatus !== 'all') params.set('status', state.filterStatus);
    else params.delete('status');

    if (state.filterChannel) params.set('channel', state.filterChannel);
    else params.delete('channel');

    if (state.filterDateFrom) params.set('dateFrom', state.filterDateFrom);
    else params.delete('dateFrom');

    if (state.filterDateTo) params.set('dateTo', state.filterDateTo);
    else params.delete('dateTo');

    if (state.sortOrder !== 'soonest') params.set('order', state.sortOrder);
    else params.delete('order');

    if (state.agendaDateMode !== 'up_to') params.set('dateMode', state.agendaDateMode);
    else params.delete('dateMode');

    if (!state.omitCompleted) params.set('omitCompleted', 'false');
    else params.delete('omitCompleted');

    if (pinnedActivityId) params.set('id', pinnedActivityId);
    else if (pinnedActivityId === null) params.delete('id');

    return params;
}

/** Enlace de una fila: conserva los filtros visibles y apunta a esa actividad. */
export function activityListHref(activityId: string, currentSearch: string): string {
    const params = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch);
    params.set('id', activityId);
    return `/actividades?${params.toString()}`;
}

export function activityModalUrlDecision(input: {
    urlId: string | null;
    pinnedActivityId: string | null | undefined;
    ignoreStaleUrlId: boolean;
    lastProcessedUrlId: string | null;
    isModalOpen: boolean;
}): 'ignore' | 'close' | 'keep' | 'open' {
    if (!input.urlId) {
        if (input.pinnedActivityId) return 'keep';
        if (input.lastProcessedUrlId !== null) return 'close';
        return 'ignore';
    }
    if (input.ignoreStaleUrlId) return 'ignore';
    if (input.pinnedActivityId && input.urlId !== input.pinnedActivityId) return 'keep';
    if (input.urlId === input.lastProcessedUrlId && input.isModalOpen) return 'keep';
    return 'open';
}
