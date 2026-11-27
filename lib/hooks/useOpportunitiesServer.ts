import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { db } from '@/lib/db';
import { useSyncStore } from '@/lib/stores/useSyncStore';
import { matchesSearchTokens, getSearchTokens, getPhoneIlikePatterns, accentInsensitiveCondition, applyAccentInsensitiveFilter } from '@/lib/utils';
import { getCellphoneSearchDigits, findPhoneMatchesServer, findPhoneMatchesLocal, opportunityMatchesPhone, PhoneSearchMatches } from '@/lib/phoneSearch';
import { computeOpportunityActivitySummary, OpportunityActivitySummary, ActivityItem } from '@/lib/opportunityActivities';
import { PhaseCatalogItem, calculateTotalAmount, DEFAULT_OPPORTUNITIES_PAGE_SIZE } from '@/lib/opportunityColumnFilterHelpers';
import { toBogotaStartOfDayISO, toBogotaEndOfDayISO, toDateOnly, isDateOnlyInRange } from '@/lib/dateFilterHelpers';
import { buildWonCloseDateOrFilter, matchesOpportunityListDateRange } from '@/lib/opportunityListDateFilter';
import { isClosedPhaseName, splitPhaseIdsByOutcome } from '@/lib/opportunityPhase';
import { buildClosedStatusOrCondition, buildOpenPhaseOrCondition, matchesStatusFilter, matchesSetterFilter, normalizeSetterFilter, SetterFilter } from '@/lib/opportunityStatusFilter';
import { activitiesVisibleToViewer, canViewAllAccountsContactsOpportunities, sellerCanSeeOpportunity, sellerOpportunityOrFilter } from '@/lib/sellerVisibility';
import { isTiendaUser } from '@/lib/tiendaVisibility';
import { FlatQuoteItemProduct, getOpportunityIdsByProductFilters } from '@/lib/opportunityProductFilterHelpers';
import { fetchFullCatalog, PriceListProduct } from '@/lib/hooks/useProducts';
import { readFullPhaseCatalog } from '@/lib/phaseCatalogStore';
import { normalizePhaseFilterValue, opportunityMatchesPhaseIds, readPersistedPhaseIds, resolvePhaseIdQuery } from '@/lib/opportunityPhaseListFilter';
import { sameArrayValues } from '@/lib/listQueryHelpers';

export type OpportunityServer = {
    id: string;
    nombre: string;
    account_id: string;
    fase_id: string;
    fase?: string; // Should be joined or mapped
    amount: number;
    currency_id: string;
    owner_user_id: string;
    updated_at: string;
    created_at: string;
    fecha_cierre_estimada?: string | null;
    segmento_id?: number | null;
    origen_oportunidad?: string | null;
    url_origen?: string | null;
    account?: { nombre: string; canal_id?: string; ciudad?: string | null; pais_id?: number | null; pais?: string | null } | null; // Joined data
    fase_data?: { nombre: string } | null; // Joined data
    vendedor?: { full_name: string } | null; // Joined data
    actividades?: Array<{ id: string; user_id?: string | null; fecha_fin?: string | null; is_completed?: boolean; is_deleted?: boolean }> | null;
    activity_summary?: OpportunityActivitySummary;
};

type StatusFilter = 'all' | 'open' | 'won' | 'lost';

type UseOpportunitiesServerProps = {
    pageSize?: number;
    initialStatus?: string;
    /** Ignora los filtros guardados del listado (URL y sessionStorage); para vistas embebidas. */
    ignorePersistedFilters?: boolean;
    /** El home ya no filtra por estado: no relee `status` de la URL ni de la sesión. */
    ignorePersistedStatus?: boolean;
};

export function useOpportunitiesServer({ pageSize = DEFAULT_OPPORTUNITIES_PAGE_SIZE, initialStatus, ignorePersistedFilters = false, ignorePersistedStatus = false }: UseOpportunitiesServerProps = {}) {
    const [data, setData] = useState<OpportunityServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const totalAmount = calculateTotalAmount(data);

    // Helper to extract initial filter from URL or sessionStorage
    const getInitialParam = (key: string) => {
        if (typeof window === 'undefined') return null;
        if (ignorePersistedFilters) return null;
        const urlParams = new URLSearchParams(window.location.search);
        const fromUrl = urlParams.get(key);
        if (fromUrl) return fromUrl;
        const saved = sessionStorage.getItem('crm_oportunidades_state');
        if (saved) return new URLSearchParams(saved).get(key) || null;
        return null;
    };

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>(() => getInitialParam('search') || "");
    const [userFilter, setUserFilter] = useState<'mine' | 'team' | 'collab' | 'all' | 'unrestricted' | 'web'>(() => (getInitialParam('tab') as 'mine' | 'team' | 'collab' | 'all' | 'unrestricted' | 'web' | null) || 'all');
    const [accountOwnerIds, setAccountOwnerIdsState] = useState<string[]>(() => {
        const owner = getInitialParam('owner');
        return owner ? owner.split(',').filter(Boolean) : [];
    });
    // PERF: la página re-sincroniza filtros en cada cambio de URL con arrays nuevos.
    // Conservamos la misma referencia si el contenido no cambió para no repetir la consulta.
    const setAccountOwnerIds = useCallback((value: string[]) => {
        setAccountOwnerIdsState(prev => sameArrayValues(prev, value) ? prev : value);
    }, []);

    // New Hierarchical Filters
    const [channelFilter, setChannelFilter] = useState<string | null>(() => getInitialParam('channel'));
    const [subclassificationFilter, setSubclassificationFilter] = useState<number | null>(() => {
        const val = getInitialParam('subclass');
        return val ? Number(val) : null;
    });
    const [segmentFilter, setSegmentFilter] = useState<number | null>(() => {
        const val = getInitialParam('segment');
        return val ? Number(val) : null;
    });
    const [phaseFilter, setPhaseFilterState] = useState<number[]>(() => readPersistedPhaseIds(getInitialParam('phases'), getInitialParam('phase')));
    const setPhaseFilter = useCallback((value: number | number[] | null) => {
        const next = normalizePhaseFilterValue(value);
        setPhaseFilterState(prev => sameArrayValues(prev, next) ? prev : next);
    }, []);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
        if (!ignorePersistedStatus) {
            const saved = getInitialParam('status') as StatusFilter | null;
            if (saved) return saved;
        }
        return (initialStatus as StatusFilter | undefined) || 'open';
    });
    const [originFilter, setOriginFilter] = useState<string | null>(() => getInitialParam('origin'));
    const [plantaFilter, setPlantaFilter] = useState<string | null>(() => getInitialParam('planta'));
    const [familiaFilter, setFamiliaFilter] = useState<string | null>(() => getInitialParam('familia'));
    const [accountIdFilter, setAccountIdFilter] = useState<string | null>(null);
    const [idFilter, setIdFilter] = useState<string | null>(() => {
        const val = getInitialParam('oppId') || getInitialParam('id');
        return val ? val.trim() : null;
    });
    const [countryFilter, setCountryFilter] = useState<number | null>(() => {
        const val = getInitialParam('country');
        return val ? Number(val) : null;
    });
    const [cityFilter, setCityFilter] = useState<string | null>(() => getInitialParam('city'));
    const [setterFilter, setSetterFilter] = useState<SetterFilter | null>(() => normalizeSetterFilter(getInitialParam('setter')));

    // Date Filters
    const [startDate, setStartDate] = useState<string | null>(() => getInitialParam('start'));
    const [endDate, setEndDate] = useState<string | null>(() => getInitialParam('end'));
    const [startClosingDate, setStartClosingDate] = useState<string | null>(() => getInitialParam('startClose'));
    const [endClosingDate, setEndClosingDate] = useState<string | null>(() => getInitialParam('endClose'));

    // Sorting - Default to created_at descending (newest to oldest)
    const [sortField, setSortField] = useState<string>(() => {
        const p = getInitialParam('sort');
        if (p && p !== 'updated_at') return p;
        return 'created_at';
    });
    const [sortAsc, setSortAsc] = useState<boolean>(() => getInitialParam('dir') === 'asc');

    // PERF FIX: Phase IDs only stored in refs (not state) to avoid triggering refetches
    const wonPhaseIdsRef = useRef<number[]>([]);
    const lostPhaseIdsRef = useRef<number[]>([]);
    const closedPhaseIdsRef = useRef<number[]>([]);
    const allPhasesRef = useRef<PhaseCatalogItem[]>([]);
    const phasesLoadedRef = useRef(false);
    const [phasesReady, setPhasesReady] = useState(false); // State to trigger re-render

    // User Context - uses useCurrentUser to respect viewMode
    const { user, role: userRole, isVendedor } = useCurrentUser();
    const currentUserId = user?.id || null;
    const seesAllPortfolio = canViewAllAccountsContactsOpportunities(user);
    const tiendaScoped = isTiendaUser(user);
    const [subordinateIds, setSubordinateIds] = useState<string[]>([]);
    const [subordinatesLoadedFor, setSubordinatesLoadedFor] = useState<string | null>(null);
    // Un coordinador no consulta hasta conocer su equipo: así no se muestra primero una lista incompleta
    // ni se hace una consulta extra que luego se descarta.
    const subordinatesReady = userRole !== 'COORDINADOR' || subordinatesLoadedFor === currentUserId;

    // PERF FIX: Use ref for page to avoid including it in useCallback deps
    const pageRef = useRef(1);
    // Descarta respuestas de consultas viejas (filtros cambiados mientras cargaba).
    const requestIdRef = useRef(0);

    // USER ID is now retrieved directly from useCurrentUser

    // Fetch subordinates for team view if user is a coordinator
    useEffect(() => {
        if (userRole === 'COORDINADOR' && currentUserId) {
            let cancelled = false;
            supabase
                .from('CRM_Usuarios')
                .select('id')
                .contains('coordinadores', [currentUserId])
                .then(({ data, error }) => {
                    if (cancelled) return;
                    if (!error && data) {
                        const ids = data.map(u => u.id);
                        setSubordinateIds(prev => sameArrayValues(prev, ids) ? prev : ids);
                    }
                    setSubordinatesLoadedFor(currentUserId);
                }, () => {
                    if (!cancelled) setSubordinatesLoadedFor(currentUserId);
                });
            return () => { cancelled = true; };
        }
    }, [userRole, currentUserId]);

    // Load closed phase IDs on mount - store in refs AND state
    useEffect(() => {
        if (phasesLoadedRef.current) return;
        const loadClosedPhases = async () => {
            let phases: PhaseCatalogItem[] = [];

            if (!navigator.onLine) {
                const localPhases = await readFullPhaseCatalog();
                phases = localPhases;
            } else {
                try {
                    const { data, error } = await supabase
                        .from('CRM_FasesOportunidad')
                        .select('id, nombre, canal_id, orden');
                    if (!error && data && data.length > 0) {
                        phases = data;
                    } else {
                        phases = await readFullPhaseCatalog();
                    }
                } catch {
                    phases = await readFullPhaseCatalog();
                }
            }

            if (phases && phases.length > 0) {
                allPhasesRef.current = phases;
                // Ganada / perdida se calcula SOLO por la fase (nombre, sin tildes ni mayúsculas).
                const { won, lost } = splitPhaseIdsByOutcome(phases);

                wonPhaseIdsRef.current = won;
                lostPhaseIdsRef.current = lost;
                closedPhaseIdsRef.current = [...won, ...lost];
            }
            // Always set to true so offline doesn't block indefinitely
            phasesLoadedRef.current = true;
            setPhasesReady(true); // Trigger re-render to enable fetching
        };
        loadClosedPhases();
    }, []);

    // PERF FIX: Removed `page`, `wonPhaseIds`, `lostPhaseIds`, `closedPhaseIds` from deps.
    // `page` is tracked via pageRef to avoid re-creating the callback on pagination.
    // Phase IDs are read from refs (populated once on mount) to avoid triggering
    // a cascade of refetches when they resolve after initial load.
    const fetchOpportunities = useCallback(async (isLoadMore = false) => {
        if (!currentUserId || !userRole) return; // Wait for user and role
        if (!phasesLoadedRef.current) return; // Wait for phases to load
        if (!subordinatesReady) return; // Coordinador: esperar a conocer su equipo

        const requestId = ++requestIdRef.current;
        const isStale = () => requestId !== requestIdRef.current;
        const setIsLoadingData = useSyncStore.getState().setIsLoadingData;
        setLoading(true);
        setIsLoadingData(true);
        const currentPage = isLoadMore ? pageRef.current + 1 : 1;
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const fetchOffline = async () => {
            console.log("[useOpportunitiesServer] Falling back to local Dexie database...");
            let localOpps = await db.opportunities.toArray();
            if (tiendaScoped && currentUserId) {
                localOpps = localOpps.filter(o => o.owner_user_id === currentUserId);
            }
            const allAccounts = await db.accounts.toArray();
            const allPhases = await readFullPhaseCatalog();
            const { data: usersData } = await supabase.from('CRM_Usuarios').select('id, full_name, email');

            const accMap = new Map(allAccounts.map(a => [a.id, a]));
            const userMap = new Map((usersData || []).map(u => [u.id, u]));
            const phaseMap = new Map(allPhases.map(p => [p.id, p]));

            // Asesor (VENDEDOR): solo sus oportunidades (dueño) y aquellas donde es colaborador,
            // sin importar la pestaña (Todas, Web, etc.).
            if (!seesAllPortfolio && isVendedor && currentUserId) {
                const sellerCollabs = await db.opportunityCollaborators.where('usuario_id').equals(currentUserId).toArray();
                const sellerCollabIds = new Set(sellerCollabs.filter(c => !c.is_deleted).map(c => c.oportunidad_id));
                localOpps = localOpps.filter(o => sellerCanSeeOpportunity(o, currentUserId, sellerCollabIds));
            }

            if (searchTerm && searchTerm.trim()) {
                // Búsqueda por celular: el de la cuenta, el de cualquiera de sus contactos
                // o el de un contacto ligado directamente a la oportunidad (contactos_ids)
                const contactPhonesByAccount = new Map<string, string[]>();
                let localPhoneMatches: PhoneSearchMatches | null = null;
                const localPhoneDigits = getCellphoneSearchDigits(searchTerm);
                if (localPhoneDigits) {
                    const allContacts = await db.contacts.toArray();
                    for (const c of allContacts) {
                        if (c.is_deleted || !c.telefono) continue;
                        const list = contactPhonesByAccount.get(c.account_id) || [];
                        list.push(c.telefono);
                        contactPhonesByAccount.set(c.account_id, list);
                    }
                    localPhoneMatches = findPhoneMatchesLocal(allContacts, allAccounts, localPhoneDigits);
                }
                localOpps = localOpps.filter(o =>
                    opportunityMatchesPhone(o, localPhoneMatches) ||
                    matchesSearchTokens([
                        o.id,
                        o.nombre,
                        accMap.get(o.account_id)?.nombre,
                        userMap.get(o.owner_user_id || '')?.full_name,
                        o.origen_oportunidad,
                        accMap.get(o.account_id)?.telefono,
                        ...(contactPhonesByAccount.get(o.account_id) || [])
                    ], searchTerm)
                );
            }

            if (idFilter && idFilter.trim()) {
                const cleanId = idFilter.trim().toLowerCase();
                localOpps = localOpps.filter(o => o.id && o.id.toLowerCase().includes(cleanId));
            }

            if (channelFilter) {
                localOpps = localOpps.filter(o => accMap.get(o.account_id)?.canal_id === channelFilter);
            }

            if (subclassificationFilter) {
                localOpps = localOpps.filter(o => accMap.get(o.account_id)?.subclasificacion_id === subclassificationFilter);
            }

            if (segmentFilter) {
                localOpps = localOpps.filter(o => o.segmento_id === segmentFilter);
            }

            if (phaseFilter.length > 0) {
                localOpps = localOpps.filter(o => opportunityMatchesPhaseIds(o.fase_id, phaseFilter, allPhasesRef.current));
            }

            const isFilteringExplicitClosedPhase = phaseFilter.some(id =>
                id > 0 && allPhasesRef.current.some(p => Number(p.id) === id && isClosedPhaseName(p.nombre))
            );

            if (!isFilteringExplicitClosedPhase && statusFilter !== 'all') {
                // Ganada = fase "Cerrada ganada"; Perdida = fase "Cerrada perdida" (solo por fase).
                localOpps = localOpps.filter(o =>
                    matchesStatusFilter(o, statusFilter, wonPhaseIdsRef.current, lostPhaseIdsRef.current)
                );
            }

            if (setterFilter) {
                localOpps = localOpps.filter(o => matchesSetterFilter((o as any).setter, setterFilter));
            }

            if (accountIdFilter) {
                localOpps = localOpps.filter(o => o.account_id === accountIdFilter);
            }

            if (countryFilter) {
                localOpps = localOpps.filter(o => accMap.get(o.account_id)?.pais_id === countryFilter);
            }

            if (cityFilter && cityFilter.trim() !== '') {
                const lowerCity = cityFilter.trim().toLowerCase();
                localOpps = localOpps.filter(o => accMap.get(o.account_id)?.ciudad?.toLowerCase().includes(lowerCity));
            }

            if (originFilter) {
                const lowerOrigin = originFilter.toLowerCase();
                if (lowerOrigin === 'wp') {
                    localOpps = localOpps.filter(o => {
                        if (!o.origen_oportunidad) return false;
                        const val = o.origen_oportunidad.toLowerCase();
                        return val.includes('wp') || val.includes('whatsapp');
                    });
                } else {
                    localOpps = localOpps.filter(o => {
                        if (!o.origen_oportunidad) return false;
                        return o.origen_oportunidad.toLowerCase().includes(lowerOrigin);
                    });
                }
            }

            if (plantaFilter || familiaFilter) {
                const allQuotes = await db.quotes.toArray();
                const allQuoteItems = await db.quoteItems.toArray();
                let catalog: PriceListProduct[] = [];
                try {
                    catalog = await fetchFullCatalog();
                } catch {
                    catalog = [];
                }
                const prodMap = new Map(catalog.map(p => [p.id, p]));
                const quoteOppMap = new Map(allQuotes.map(q => [q.id, q.opportunity_id]));

                const flatItems: FlatQuoteItemProduct[] = [];
                for (const qi of allQuoteItems) {
                    if (qi.is_deleted) continue;
                    const oppId = quoteOppMap.get(qi.cotizacion_id);
                    if (!oppId) continue;
                    const prod = qi.producto_id ? prodMap.get(qi.producto_id) : null;
                    flatItems.push({
                        opportunity_id: oppId,
                        planta: prod?.planta || null,
                        familia: prod?.familia || null
                    });
                }

                const matchingOppIds = new Set(getOpportunityIdsByProductFilters(flatItems, {
                    planta: plantaFilter,
                    familia: familiaFilter
                }));

                localOpps = localOpps.filter(o => matchingOppIds.has(o.id));
            }

            if (startDate || endDate) {
                localOpps = localOpps.filter(o => matchesOpportunityListDateRange(o, statusFilter, startDate, endDate));
            }

            // fecha_cierre_estimada es "solo día": se compara como YYYY-MM-DD, sin pasar a UTC (evita corrimiento de un día).
            if (startClosingDate || endClosingDate) {
                localOpps = localOpps.filter(o => isDateOnlyInRange(o.fecha_cierre_estimada, startClosingDate, endClosingDate));
            }

            if (!tiendaScoped && accountOwnerIds && accountOwnerIds.length > 0) {
                localOpps = localOpps.filter(o => o.owner_user_id && accountOwnerIds.includes(o.owner_user_id));
            }

            if (userFilter !== 'unrestricted') {
                if (userFilter === 'mine' && currentUserId) {
                    localOpps = localOpps.filter(o => o.owner_user_id === currentUserId || (!isVendedor && o.created_by === currentUserId));
                } else if (userFilter === 'collab') {
                    const localCollabs = await db.opportunityCollaborators.where('usuario_id').equals(currentUserId || '').toArray();
                    const collabOppIds = new Set(localCollabs.filter(c => !c.is_deleted).map(c => c.oportunidad_id));
                    localOpps = localOpps.filter(o => o.owner_user_id === currentUserId || collabOppIds.has(o.id));
                } else if (userFilter === 'all') {
                    if (userRole !== 'ADMIN' && currentUserId && !seesAllPortfolio) {
                        const localCollabs = await db.opportunityCollaborators.where('usuario_id').equals(currentUserId || '').toArray();
                        const collabOppIds = new Set(localCollabs.filter(c => !c.is_deleted).map(c => c.oportunidad_id));
                        localOpps = localOpps.filter(o =>
                            o.owner_user_id === currentUserId ||
                            (!isVendedor && o.created_by === currentUserId) ||
                            collabOppIds.has(o.id) ||
                            (userRole === 'COORDINADOR' && o.owner_user_id && subordinateIds.includes(o.owner_user_id))
                        );
                    }
                } else if (userFilter === 'team' && userRole !== 'ADMIN') {
                    if (userRole === 'COORDINADOR') {
                        localOpps = localOpps.filter(o => o.owner_user_id === currentUserId || (o.owner_user_id && subordinateIds.includes(o.owner_user_id)));
                    } else {
                        localOpps = localOpps.filter(o => o.owner_user_id === currentUserId);
                    }
                } else if (userFilter === 'web') {
                    localOpps = localOpps.filter(o =>
                        Boolean((o.url_origen && o.url_origen.trim() !== '') ||
                            (o.origen_oportunidad && (
                                o.origen_oportunidad.toLowerCase().includes('web') ||
                                o.origen_oportunidad.toLowerCase().includes('pagina') ||
                                o.origen_oportunidad.toLowerCase().includes('página')
                            )))
                    );
                }
            }

            localOpps.sort((a, b) => {
                let valA: string | number = '';
                let valB: string | number = '';

                if (sortField === 'nombre') {
                    valA = a.nombre || "";
                    valB = b.nombre || "";
                } else if (sortField === 'amount') {
                    valA = a.amount || 0;
                    valB = b.amount || 0;
                } else if (sortField === 'account_nombre') {
                    valA = accMap.get(a.account_id)?.nombre || "";
                    valB = accMap.get(b.account_id)?.nombre || "";
                } else if (sortField === 'fecha_cierre_estimada') {
                    valA = a.fecha_cierre_estimada ? new Date(a.fecha_cierre_estimada).getTime() : 0;
                    valB = b.fecha_cierre_estimada ? new Date(b.fecha_cierre_estimada).getTime() : 0;
                } else if (sortField === 'created_at') {
                    valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                } else if (sortField === 'vendedor_nombre') {
                    valA = userMap.get(a.owner_user_id || '')?.full_name || "";
                    valB = userMap.get(b.owner_user_id || '')?.full_name || "";
                } else {
                    valA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                    valB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                }

                if (valA < valB) return sortAsc ? -1 : 1;
                if (valA > valB) return sortAsc ? 1 : -1;
                return String(b.id).localeCompare(String(a.id));
            });

            const totalCount = localOpps.length;
            const paginatedOpps = localOpps.slice(from, to + 1);
            const oppIds = paginatedOpps.map(i => i.id);
            const localActs = activitiesVisibleToViewer(
                await db.activities.where('opportunity_id').anyOf(oppIds).toArray(),
                userRole,
                currentUserId,
                user
            );
            const actsByOpp = new Map<string, any[]>();
            localActs.forEach(act => {
                if (act.opportunity_id) {
                    const list = actsByOpp.get(act.opportunity_id) || [];
                    list.push(act);
                    actsByOpp.set(act.opportunity_id, list);
                }
            });

            const flattenedResults = paginatedOpps.map(item => {
                const acc = accMap.get(item.account_id);
                const ph = phaseMap.get(item.fase_id as number);
                const itemActs = actsByOpp.get(item.id) || [];
                const visibleActs = activitiesVisibleToViewer(itemActs, userRole, currentUserId, user);
                const usr = userMap.get(item.owner_user_id || '');
                return {
                    ...item,
                    account: acc ? { nombre: acc.nombre, canal_id: acc.canal_id, ciudad: acc.ciudad, pais_id: acc.pais_id } : null,
                    fase_data: ph ? { nombre: ph.nombre } : null,
                    vendedor: usr ? { full_name: usr.full_name || usr.email } : null,
                    actividades: visibleActs,
                    activity_summary: computeOpportunityActivitySummary(visibleActs)
                };
            });

            if (isStale()) return;
            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = flattenedResults.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems] as any;
                });
                pageRef.current = currentPage;
            } else {
                setData(flattenedResults as any);
                pageRef.current = 1;
            }
            setCount(totalCount);
            setHasMore(from + paginatedOpps.length < totalCount);
        };

        if (!navigator.onLine) {
            try {
                await fetchOffline();
            } finally {
                if (!isStale()) {
                    setLoading(false);
                    useSyncStore.getState().setIsLoadingData(false);
                }
            }
            return;
        }

        try {
            // Cuando la búsqueda completa es un celular/teléfono: cuentas cuyo teléfono (o el de alguno de sus contactos) coincide
            const phoneDigits = getCellphoneSearchDigits(searchTerm);
            const searchIsPhone = Boolean(phoneDigits);

            // PERF: las consultas previas son independientes entre sí; antes se esperaban una por una
            // (hasta 5 viajes al servidor en serie). Ahora salen todas a la vez.
            const phoneMatchesPromise: Promise<PhoneSearchMatches | null> = phoneDigits
                ? findPhoneMatchesServer(supabase, phoneDigits)
                : Promise.resolve(null);

            const searchIdsPromise = (async (): Promise<{ accountIds: string[]; userIds: string[] }> => {
                if (!(searchTerm && searchTerm.trim() && !searchIsPhone)) return { accountIds: [], userIds: [] };
                const tokens = getSearchTokens(searchTerm);
                let accQuery = supabase.from('CRM_Cuentas').select('id').eq('is_deleted', false);
                let userQuery = supabase.from('CRM_Usuarios').select('id');
                // Sin depender de tildes/eñes: el token viene normalizado ("cataluna") y el dato no ("CATALUÑA").
                for (const token of tokens) {
                    accQuery = applyAccentInsensitiveFilter(accQuery, 'nombre', token);
                    userQuery = applyAccentInsensitiveFilter(userQuery, 'full_name', token);
                }
                const [accountsRes, usersRes] = await Promise.all([
                    accQuery.limit(100),
                    userQuery.limit(100)
                ]);
                return {
                    accountIds: accountsRes.data ? accountsRes.data.map(a => a.id) : [],
                    userIds: usersRes.data ? usersRes.data.map(u => u.id) : [],
                };
            })();

            const collabPromise = (async (): Promise<string[]> => {
                if (!(isVendedor || userFilter === 'collab' || (userFilter === 'all' && userRole !== 'ADMIN'))) return [];
                const { data: collabRows } = await supabase
                    .from('CRM_Oportunidades_Colaboradores')
                    .select('oportunidad_id')
                    .eq('usuario_id', currentUserId)
                    .eq('is_deleted', false);
                return Array.from(new Set((collabRows || []).map(row => row.oportunidad_id).filter(Boolean)));
            })();

            const productPromise = (async (): Promise<string[] | null> => {
                if (!(plantaFilter || familiaFilter)) return null;
                let quoteItemsQuery = supabase
                    .from('CRM_CotizacionItems')
                    .select('cotizacion:CRM_Cotizaciones!inner(opportunity_id), producto:CRM_ListaDePrecios!inner(planta, familia)')
                    .eq('is_deleted', false);

                if (plantaFilter) {
                    quoteItemsQuery = quoteItemsQuery.eq('producto.planta', plantaFilter);
                }
                if (familiaFilter) {
                    quoteItemsQuery = quoteItemsQuery.eq('producto.familia', familiaFilter);
                }

                const { data: quoteItemsData, error: qiError } = await quoteItemsQuery;
                if (qiError) {
                    console.warn('[useOpportunitiesServer] Error al filtrar por planta/familia:', qiError);
                }
                return Array.from(new Set((quoteItemsData || []).map((it: { cotizacion?: { opportunity_id?: string } | Array<{ opportunity_id?: string }> | null }) => {
                    const oppId = Array.isArray(it.cotizacion) ? it.cotizacion[0]?.opportunity_id : it.cotizacion?.opportunity_id;
                    return oppId;
                }).filter(Boolean))) as string[];
            })();

            const idPromise = (async (): Promise<string[] | null> => {
                if (!(idFilter && idFilter.trim())) return null;
                const cleanId = idFilter.trim();
                const isFullUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
                if (isFullUuid) return [cleanId];
                try {
                    const { data: rpcIds, error: rpcErr } = await supabase.rpc('search_opportunities_by_id', { search_term: cleanId });
                    return !rpcErr && Array.isArray(rpcIds) ? rpcIds : [];
                } catch {
                    return [];
                }
            })();

            const [phoneMatches, searchIds, collabOppIds, matchedProductOppIds, matchedIdOppIds] = await Promise.all([
                phoneMatchesPromise,
                searchIdsPromise,
                collabPromise,
                productPromise,
                idPromise,
            ]);
            if (isStale()) return;

            const phoneAccountIds = new Set<string>(phoneMatches?.accountIds ?? []);
            const phoneContactIds = new Set<string>(phoneMatches?.contactIds ?? []);
            const serverPhoneMatches: PhoneSearchMatches = { accountIds: phoneAccountIds, contactIds: phoneContactIds };
            const searchAccountIds = searchIds.accountIds;
            const searchUserIds = searchIds.userIds;

            const useInnerJoin = Boolean(channelFilter || subclassificationFilter || countryFilter || (cityFilter && cityFilter.trim() !== ''));
            const accountRelation = useInnerJoin ? 'account:CRM_Cuentas!inner(nombre, canal_id, subclasificacion_id, ciudad, pais_id)' : 'account:CRM_Cuentas(nombre, canal_id, subclasificacion_id, ciudad, pais_id)';

            // Builder unificado para aplicar idénticos filtros a la consulta de datos y al conteo de totales
            const applyCommonFilters = (targetQuery: any) => {
                let q = targetQuery.eq('is_deleted', false);

                if (matchedIdOppIds !== null) {
                    if (matchedIdOppIds.length > 0) {
                        q = q.in('id', matchedIdOppIds);
                    } else {
                        q = q.eq('id', '00000000-0000-0000-0000-000000000000');
                    }
                }

                if (searchTerm && searchTerm.trim() && searchIsPhone) {
                    const phoneConditions = [`nombre.ilike.${getPhoneIlikePatterns(phoneDigits)[0]}`];
                    if (phoneAccountIds.size > 0) {
                        phoneConditions.push(`account_id.in.(${Array.from(phoneAccountIds).join(',')})`);
                    }
                    if (phoneContactIds.size > 0) {
                        // Oportunidades donde el contacto con ese celular está ligado directamente
                        phoneConditions.push(`contactos_ids.ov.{${Array.from(phoneContactIds).join(',')}}`);
                    }
                    q = q.or(phoneConditions.join(','));
                } else if (searchTerm && searchTerm.trim()) {
                    const cleanSearch = searchTerm.trim();
                    const searchIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSearch);
                    if (searchIsUuid) {
                        q = q.eq('id', cleanSearch);
                    } else {
                        const tokens = getSearchTokens(cleanSearch);
                        for (const token of tokens) {
                            const orConditions = [accentInsensitiveCondition('nombre', token)];
                            if (searchAccountIds.length > 0) {
                                orConditions.push(`account_id.in.(${searchAccountIds.join(',')})`);
                            }
                            if (searchUserIds.length > 0) {
                                orConditions.push(`owner_user_id.in.(${searchUserIds.join(',')})`);
                            }
                            q = q.or(orConditions.join(','));
                        }
                    }
                }

                if (channelFilter) {
                    q = q.eq('account.canal_id', channelFilter);
                }

                if (subclassificationFilter) {
                    q = q.eq('account.subclasificacion_id', subclassificationFilter);
                }

                const isFilteringExplicitClosedPhase = phaseFilter.some(id =>
                    id > 0 && allPhasesRef.current.some(p => Number(p.id) === id && isClosedPhaseName(p.nombre))
                );

                if (!isFilteringExplicitClosedPhase) {
                    if (statusFilter === 'won' || statusFilter === 'lost') {
                        // Fase "Cerrada ganada" / "Cerrada perdida" (solo por fase)
                        const closedCondition = buildClosedStatusOrCondition(statusFilter, wonPhaseIdsRef.current, lostPhaseIdsRef.current);
                        if (closedCondition) q = q.or(closedCondition);
                    } else if (statusFilter === 'open') {
                        const openPhaseCondition = buildOpenPhaseOrCondition(closedPhaseIdsRef.current);
                        if (openPhaseCondition) q = q.or(openPhaseCondition);
                    }
                }

                if (setterFilter) {
                    q = setterFilter === 'NONE' ? q.is('setter', null) : q.eq('setter', setterFilter);
                }

                if (segmentFilter) {
                    q = q.eq('segmento_id', segmentFilter);
                }

                if (phaseFilter.length > 0) {
                    const { includeUnassigned, faseIds } = resolvePhaseIdQuery(phaseFilter, allPhasesRef.current);
                    if (includeUnassigned && faseIds.length === 0) {
                        q = q.is('fase_id', null);
                    } else if (!includeUnassigned && faseIds.length === 1) {
                        q = q.eq('fase_id', faseIds[0]);
                    } else if (!includeUnassigned && faseIds.length > 1) {
                        q = q.in('fase_id', faseIds);
                    } else if (includeUnassigned && faseIds.length > 0) {
                        q = q.or(`fase_id.is.null,fase_id.in.(${faseIds.join(',')})`);
                    } else {
                        q = q.eq('fase_id', -1);
                    }
                }

                if (accountIdFilter) {
                    q = q.eq('account_id', accountIdFilter);
                }

                if (countryFilter) {
                    q = q.eq('account.pais_id', countryFilter);
                }

                if (cityFilter && cityFilter.trim() !== '') {
                    q = q.ilike('account.ciudad', `%${cityFilter.trim()}%`);
                }

                if (originFilter) {
                    const lowerOrigin = originFilter.toLowerCase();
                    if (lowerOrigin === 'wp') {
                        q = q.or('origen_oportunidad.ilike.%wp%,origen_oportunidad.ilike.%whatsapp%');
                    } else {
                        q = q.ilike('origen_oportunidad', `%${lowerOrigin}%`);
                    }
                }

                if (matchedProductOppIds !== null) {
                    if (matchedProductOppIds.length > 0) {
                        q = q.in('id', matchedProductOppIds);
                    } else {
                        q = q.eq('id', '00000000-0000-0000-0000-000000000000');
                    }
                }

                // Ganadas: el rango superior filtra fecha_cierre_estimada (o created_at si el cierre es null).
                // Todas, Abiertas y Perdidas siguen en created_at. El conteo usa applyCommonFilters.
                const wonDateOr = statusFilter === 'won' ? buildWonCloseDateOrFilter(startDate, endDate) : null;
                if (wonDateOr) {
                    q = q.or(wonDateOr);
                } else {
                    if (startDate) {
                        const startISO = toBogotaStartOfDayISO(startDate);
                        if (startISO) q = q.gte('created_at', startISO);
                    }

                    if (endDate) {
                        const endISO = toBogotaEndOfDayISO(endDate);
                        if (endISO) q = q.lte('created_at', endISO);
                    }
                }

                // Fecha de cierre del listado: solo fecha_cierre_estimada (columna date, día inclusive).
                // No hay columna de cierre real filtrable; resolveOpportunityCloseDate es solo de presentación.
                if (startClosingDate) {
                    const startCloseDay = toDateOnly(startClosingDate);
                    if (startCloseDay) q = q.gte('fecha_cierre_estimada', startCloseDay);
                }

                if (endClosingDate) {
                    const endCloseDay = toDateOnly(endClosingDate);
                    if (endCloseDay) q = q.lte('fecha_cierre_estimada', endCloseDay);
                }

                if (!tiendaScoped && accountOwnerIds && accountOwnerIds.length > 0) {
                    q = q.in('owner_user_id', accountOwnerIds);
                }

                if (userFilter !== 'unrestricted') {
                    if (userFilter === 'mine') {
                        q = q.eq('owner_user_id', currentUserId);
                    } else if (userFilter === 'team') {
                        if (userRole === 'COORDINADOR') {
                            q = q.in('owner_user_id', [currentUserId, ...subordinateIds]);
                        } else if (userRole !== 'ADMIN') {
                            q = q.eq('owner_user_id', currentUserId);
                        }
                    } else if (userFilter === 'collab') {
                        const ownershipConditions = [`owner_user_id.eq.${currentUserId}`];
                        if (collabOppIds.length > 0) {
                            ownershipConditions.push(`id.in.(${collabOppIds.join(',')})`);
                        }
                        q = q.or(ownershipConditions.join(','));
                    } else if (userFilter === 'all') {
                        if (userRole !== 'ADMIN' && !seesAllPortfolio) {
                            const visibleConditions = [`owner_user_id.eq.${currentUserId}`];
                            // El asesor solo ve las suyas (dueño) y en las que colabora; no las que creó para otro.
                            if (!isVendedor) {
                                visibleConditions.push(`created_by.eq.${currentUserId}`);
                            }
                            if (collabOppIds.length > 0) {
                                visibleConditions.push(`id.in.(${collabOppIds.join(',')})`);
                            }
                            if (userRole === 'COORDINADOR' && subordinateIds.length > 0) {
                                visibleConditions.push(`owner_user_id.in.(${subordinateIds.join(',')})`);
                            }
                            q = q.or(visibleConditions.join(','));
                        }
                    } else if (userFilter === 'web') {
                        q = q.or('url_origen.not.is.null,origen_oportunidad.ilike.%web%,origen_oportunidad.ilike.%pagina%');
                    }
                }

                // Asesor (VENDEDOR): restricción fija en cualquier pestaña/filtro (Todas, Web, cuenta, búsqueda).
                if (!seesAllPortfolio && isVendedor && currentUserId) {
                    q = q.or(sellerOpportunityOrFilter(currentUserId, collabOppIds));
                }

                // Tienda: solo oportunidades que posee, en cualquier pestaña (Todas, Web, equipo, colaboración).
                if (tiendaScoped && currentUserId) {
                    q = q.eq('owner_user_id', currentUserId);
                }

                return q;
            };

            // 1. DATA QUERY (Sin count: 'exact' para evitar escaneo masivo sobre joins de actividades)
            let dataQuery = supabase
                .from('CRM_Oportunidades')
                .select(`
                    id,
                    nombre,
                    account_id,
                    fase_id,
                    amount,
                    currency_id,
                    owner_user_id,
                    updated_at,
                    created_at,
                    fecha_cierre_estimada,
                    segmento_id,
                    created_by,
                    origen_oportunidad,
                    categoria_oportunidad,
                    contactos_ids,
                    setter,
                    ${accountRelation},
                    fase_data:CRM_FasesOportunidad(nombre),
                    vendedor:CRM_Usuarios!owner_user_id(full_name)
                `);
            // PERF: se quitó `actividades_count:CRM_Actividades(count)`. Era un conteo de actividades
            // por cada fila (×100 por página) y la lista nunca lo mostraba (activity_summary va fijo abajo).

            dataQuery = applyCommonFilters(dataQuery);

            if (sortField === 'account_nombre') {
                dataQuery = dataQuery.order('account(nombre)', { ascending: sortAsc });
            } else if (sortField === 'vendedor_nombre') {
                dataQuery = dataQuery.order('vendedor(full_name)', { ascending: sortAsc });
            } else {
                dataQuery = dataQuery.order(sortField as any, { ascending: sortAsc });
            }
            if (sortField !== 'id') dataQuery = dataQuery.order('id', { ascending: false });

            dataQuery = dataQuery.range(from, to);

            // 2. TOTALS QUERY (Desacoplada con HEAD request: 0 bytes de payload, ejecuta en <15ms con índices)
            // Se ejecuta en paralelo solo en la carga inicial o al cambiar filtros (no en paginación/loadMore)
            let countPromise: Promise<number | null>;

            if (!isLoadMore) {
                const accountCountRelation = useInnerJoin ? 'account:CRM_Cuentas!inner(id)' : '';
                let countQuery = supabase
                    .from('CRM_Oportunidades')
                    .select(accountCountRelation ? `id, ${accountCountRelation}` : 'id', { count: 'exact', head: true });

                countQuery = applyCommonFilters(countQuery);

                countPromise = (async () => {
                    const { count: queryCount, error: countErr } = await countQuery;
                    if (countErr) {
                        console.warn("Error en conteo de totales de oportunidades:", countErr);
                        return null;
                    }
                    return queryCount ?? null;
                })();
            } else {
                countPromise = Promise.resolve(null);
            }

            // Ejecución en paralelo (datos, conteo y cambios locales pendientes)
            const pendingChangesPromise = db.outbox
                .where('entity_type').equals('CRM_Oportunidades')
                .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                .toArray()
                .catch(() => []);
            const [{ data: result, error }, totalCount, pendingChanges] = await Promise.all([
                dataQuery,
                countPromise,
                pendingChangesPromise
            ]);

            if (error) throw error;
            if (isStale()) return;

            const resultIds = result ? (result as any[]).map(r => r.id) : [];
            const missingPendingIds = new Set<string>();

            for (const change of pendingChanges) {
                if (!resultIds.includes(change.entity_id)) {
                    missingPendingIds.add(change.entity_id);
                }
            }

            let pendingLocalOpps: any[] = [];
            if (missingPendingIds.size > 0) {
                const localOpps = await db.opportunities.where('id').anyOf(Array.from(missingPendingIds)).toArray();
                const pendingCollabIds = new Set(collabOppIds);
                pendingLocalOpps = localOpps.filter((o: any) => {
                    if (!matchesOpportunityListDateRange(o, statusFilter, startDate, endDate)) return false;
                    if (tiendaScoped && currentUserId && o.owner_user_id !== currentUserId) return false;
                    if (!seesAllPortfolio && isVendedor && currentUserId && !sellerCanSeeOpportunity(o, currentUserId, pendingCollabIds) && o.created_by !== currentUserId) return false;
                    if (accountIdFilter && o.account_id !== accountIdFilter) return false;
                    if (searchIsPhone && opportunityMatchesPhone(o, serverPhoneMatches)) return true;
                    if (searchTerm) {
                        const lowerSearch = searchTerm.toLowerCase();
                        if (!o.nombre?.toLowerCase().includes(lowerSearch)) {
                            return false;
                        }
                    }
                    if (accountIdFilter && o.account_id !== accountIdFilter) return false;
                    return true;
                }).map((o: any) => ({
                    ...o,
                    _hasPendingSync: true,
                }));
            }

            // actividades_count es un array de un elemento con { count: N } devuelto por Supabase embedded count.
            // Usamos un activity_summary stub "none" para evitar cargar todos los registros de actividades en la lista.
            let combinedResults = [...pendingLocalOpps, ...(result as any[])].map((o: any) => {
                return {
                    ...o,
                    actividades: [],
                    activity_summary: { status: 'none', label: 'Sin actividad', total: 0, overdue: 0, pending: 0 }
                };
            });
            if (searchTerm && searchTerm.trim()) {
                combinedResults = combinedResults.filter(o =>
                    (searchIsPhone && opportunityMatchesPhone(o, serverPhoneMatches)) ||
                    matchesSearchTokens([
                        o.nombre,
                        o.account?.nombre,
                        o.vendedor?.full_name,
                        o.fase_data?.nombre,
                        o.origen_oportunidad
                    ], searchTerm)
                );
            }

            if (isStale()) return;
            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = combinedResults.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                pageRef.current = currentPage;
            } else {
                setData(combinedResults as any);
                pageRef.current = 1;
            }

            if (totalCount !== null) {
                setCount(totalCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            } else if (isLoadMore) {
                setHasMore(from + (result?.length || 0) < count);
            } else {
                setHasMore((result?.length || 0) >= pageSize);
            }

        } catch (err: any) {
            if (isStale()) return;
            console.error("Error fetching opportunities, executing fallback:", err?.message || err, err?.details, err?.hint, err?.code, JSON.stringify(err));
            try {
                await fetchOffline();
            } catch (fallbackErr) {
                console.error("Fallback error:", fallbackErr);
            }
        } finally {
            if (!isStale()) {
                setLoading(false);
                useSyncStore.getState().setIsLoadingData(false);
            }
        }
    }, [currentUserId, user, user?.email, user?.es_tienda, seesAllPortfolio, tiendaScoped, isVendedor, subordinateIds, subordinatesReady, pageSize, userFilter, searchTerm, accountIdFilter, idFilter, accountOwnerIds, userRole, channelFilter, subclassificationFilter, segmentFilter, phaseFilter, statusFilter, originFilter, plantaFilter, familiaFilter, countryFilter, cityFilter, setterFilter, phasesReady, startDate, endDate, startClosingDate, endClosingDate, sortField, sortAsc]);

    useEffect(() => {
        fetchOpportunities(false);
    }, [fetchOpportunities]);

    // OPTIMISTIC UI: Listen to broadcasted local mutations
    useEffect(() => {
        const handleOptimisticUpdate = (e: any) => {
            const { entityType, entityId, updates } = e.detail;
            if (entityType === 'CRM_Oportunidades') {
                setData(prev => {
                    const exists = prev.find(item => item.id === entityId);
                    if (exists) {
                        return prev.map(item => item.id === entityId ? { ...item, ...updates } : item);
                    }
                    // For inserts (new opportunities), prepend them
                    // We mock missing joined data until the next real server fetch
                    return [{ id: entityId, ...updates }, ...prev] as any[];
                });
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('crm-optimistic-update', handleOptimisticUpdate);
            return () => window.removeEventListener('crm-optimistic-update', handleOptimisticUpdate);
        }
    }, []);

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchOpportunities(true);
        }
    };

    return {
        data,
        count,
        totalAmount,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setUserFilter,
        setAccountOwnerIds,

        // New Filter Setters
        setChannelFilter,
        setSubclassificationFilter,
        setSegmentFilter,
        setPhaseFilter,
        setStatusFilter,
        setOriginFilter,
        originFilter,
        setPlantaFilter,
        plantaFilter,
        setFamiliaFilter,
        familiaFilter,
        setAccountIdFilter,
        idFilter,
        setIdFilter,
        setCountryFilter,
        countryFilter,
        setCityFilter,
        cityFilter,
        setSetterFilter,
        setterFilter,
        setStartDate,
        setEndDate,
        setStartClosingDate,
        setEndClosingDate,
        setSortField,
        setSortAsc,
        sortField,
        sortAsc,

        refresh: () => fetchOpportunities(false)
    };
}
