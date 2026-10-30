import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { db } from '@/lib/db';
import { useSyncStore } from '@/lib/stores/useSyncStore';
import { matchesSearchTokens, getSearchTokens, getPhoneIlikePatterns, accentInsensitiveCondition, applyAccentInsensitiveFilter } from '@/lib/utils';
import { getCellphoneSearchDigits, findPhoneMatchesServer, findPhoneMatchesLocal, opportunityMatchesPhone, PhoneSearchMatches } from '@/lib/phoneSearch';
import { computeOpportunityActivitySummary, OpportunityActivitySummary, ActivityItem } from '@/lib/opportunityActivities';
import { PROSPECTO_PHASE_ID, getEquivalentPhaseIds, PhaseCatalogItem, calculateTotalAmount, computeProgressiveBatch, DEFAULT_OPPORTUNITIES_PAGE_SIZE } from '@/lib/opportunityColumnFilterHelpers';
import { toStartOfDayISO, toEndOfDayISO } from '@/lib/dateFilterHelpers';
import { activitiesVisibleToViewer, sellerCanSeeOpportunity, sellerOpportunityOrFilter } from '@/lib/sellerVisibility';

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
    estado_id?: number | null;
    origen_oportunidad?: string | null;
    url_origen?: string | null;
    account?: { nombre: string; canal_id?: string; ciudad?: string | null; pais_id?: number | null; pais?: string | null } | null; // Joined data
    fase_data?: { nombre: string } | null; // Joined data
    estado_data?: { nombre: string } | null; // Joined data
    vendedor?: { full_name: string } | null; // Joined data
    actividades?: Array<{ id: string; user_id?: string | null; fecha_fin?: string | null; is_completed?: boolean; is_deleted?: boolean }> | null;
    activity_summary?: OpportunityActivitySummary;
};

type StatusFilter = 'all' | 'open' | 'won' | 'lost';

type UseOpportunitiesServerProps = {
    pageSize?: number;
    initialStatus?: string;
};

export function useOpportunitiesServer({ pageSize = DEFAULT_OPPORTUNITIES_PAGE_SIZE }: UseOpportunitiesServerProps = {}) {
    const [data, setData] = useState<OpportunityServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const totalAmount = calculateTotalAmount(data);

    // Helper to extract initial filter from URL or sessionStorage
    const getInitialParam = (key: string) => {
        if (typeof window === 'undefined') return null;
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
    const [accountOwnerIds, setAccountOwnerIds] = useState<string[]>(() => {
        const owner = getInitialParam('owner');
        return owner ? owner.split(',').filter(Boolean) : [];
    });

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
    const [phaseFilter, setPhaseFilter] = useState<number | null>(() => {
        const val = getInitialParam('phase');
        return val ? Number(val) : null;
    });
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => (getInitialParam('status') as StatusFilter | null) || 'open');
    const [originFilter, setOriginFilter] = useState<string | null>(() => getInitialParam('origin'));
    const [accountIdFilter, setAccountIdFilter] = useState<string | null>(null);
    const [countryFilter, setCountryFilter] = useState<number | null>(() => {
        const val = getInitialParam('country');
        return val ? Number(val) : null;
    });
    const [cityFilter, setCityFilter] = useState<string | null>(() => getInitialParam('city'));

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
    const [subordinateIds, setSubordinateIds] = useState<string[]>([]);

    // PERF FIX: Use ref for page to avoid including it in useCallback deps
    const pageRef = useRef(1);

    // USER ID is now retrieved directly from useCurrentUser

    // Fetch subordinates for team view if user is a coordinator
    useEffect(() => {
        if (userRole === 'COORDINADOR' && currentUserId) {
            supabase
                .from('CRM_Usuarios')
                .select('id')
                .contains('coordinadores', [currentUserId])
                .then(({ data, error }) => {
                    if (!error && data) {
                        setSubordinateIds(data.map(u => u.id));
                    }
                });
        }
    }, [userRole, currentUserId]);

    // Load closed phase IDs on mount - store in refs AND state
    useEffect(() => {
        if (phasesLoadedRef.current) return;
        const loadClosedPhases = async () => {
            let phases: PhaseCatalogItem[] = [];

            if (!navigator.onLine) {
                const localPhases = await db.phases.toArray();
                phases = localPhases;
            } else {
                try {
                    const { data, error } = await supabase
                        .from('CRM_FasesOportunidad')
                        .select('id, nombre, canal_id, orden');
                    if (!error && data && data.length > 0) {
                        phases = data;
                    } else {
                        phases = await db.phases.toArray();
                    }
                } catch {
                    phases = await db.phases.toArray();
                }
            }

            if (phases && phases.length > 0) {
                allPhasesRef.current = phases;
                const won: number[] = [];
                const lost: number[] = [];

                phases.forEach(p => {
                    const nombre = p.nombre.toLowerCase();
                    if (nombre.includes('ganada')) {
                        won.push(p.id);
                    } else if (nombre.includes('perdida')) {
                        lost.push(p.id);
                    }
                });

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
        if (!currentUserId) return; // Wait for user
        if (!phasesLoadedRef.current) return; // Wait for phases to load

        const setIsLoadingData = useSyncStore.getState().setIsLoadingData;
        setLoading(true);
        setIsLoadingData(true);
        const currentPage = isLoadMore ? pageRef.current + 1 : 1;
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const fetchOffline = async () => {
            console.log("[useOpportunitiesServer] Falling back to local Dexie database...");
            let localOpps = await db.opportunities.toArray();
            const allAccounts = await db.accounts.toArray();
            const allPhases = await db.phases.toArray();
            const { data: usersData } = await supabase.from('CRM_Usuarios').select('id, full_name, email');

            const accMap = new Map(allAccounts.map(a => [a.id, a]));
            const userMap = new Map((usersData || []).map(u => [u.id, u]));
            const phaseMap = new Map(allPhases.map(p => [p.id, p]));

            // Asesor (VENDEDOR): solo sus oportunidades (dueño) y aquellas donde es colaborador,
            // sin importar la pestaña (Todas, Web, etc.).
            if (isVendedor && currentUserId) {
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
                        o.nombre,
                        accMap.get(o.account_id)?.nombre,
                        userMap.get(o.owner_user_id || '')?.full_name,
                        o.origen_oportunidad,
                        accMap.get(o.account_id)?.telefono,
                        ...(contactPhonesByAccount.get(o.account_id) || [])
                    ], searchTerm)
                );
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

            if (phaseFilter) {
                if (phaseFilter === PROSPECTO_PHASE_ID) {
                    localOpps = localOpps.filter(o => !o.fase_id);
                } else {
                    const equivalentIds = getEquivalentPhaseIds(allPhasesRef.current, phaseFilter);
                    localOpps = localOpps.filter(o => o.fase_id && equivalentIds.includes(Number(o.fase_id)));
                }
            }

            if (statusFilter === 'won' && wonPhaseIdsRef.current.length > 0) {
                localOpps = localOpps.filter(o => wonPhaseIdsRef.current.includes(o.fase_id as number));
            } else if (statusFilter === 'lost' && lostPhaseIdsRef.current.length > 0) {
                localOpps = localOpps.filter(o => lostPhaseIdsRef.current.includes(o.fase_id as number));
            } else if (statusFilter === 'open' && closedPhaseIdsRef.current.length > 0) {
                localOpps = localOpps.filter(o =>
                    !closedPhaseIdsRef.current.includes(o.fase_id as number) &&
                    ![2, 3, 4, 11, 14].includes(o.estado_id as number)
                );
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

            if (startDate) {
                const startISO = toStartOfDayISO(startDate);
                localOpps = localOpps.filter(o => o.created_at && (!startISO || new Date(o.created_at) >= new Date(startISO)));
            }
            if (endDate) {
                const endISO = toEndOfDayISO(endDate);
                localOpps = localOpps.filter(o => o.created_at && (!endISO || new Date(o.created_at) <= new Date(endISO)));
            }

            if (startClosingDate) {
                const startCloseISO = toStartOfDayISO(startClosingDate);
                localOpps = localOpps.filter(o => o.fecha_cierre_estimada && (!startCloseISO || new Date(o.fecha_cierre_estimada) >= new Date(startCloseISO)));
            }
            if (endClosingDate) {
                const endCloseISO = toEndOfDayISO(endClosingDate);
                localOpps = localOpps.filter(o => o.fecha_cierre_estimada && (!endCloseISO || new Date(o.fecha_cierre_estimada) <= new Date(endCloseISO)));
            }

            if (accountOwnerIds && accountOwnerIds.length > 0) {
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
                    if (userRole !== 'ADMIN' && currentUserId) {
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
                let valA: any;
                let valB: any;

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
                currentUserId
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
                const usr = userMap.get(item.owner_user_id || '');
                return {
                    ...item,
                    account: acc ? { nombre: acc.nombre, canal_id: acc.canal_id, ciudad: acc.ciudad, pais_id: acc.pais_id } : null,
                    fase_data: ph ? { nombre: ph.nombre } : null,
                    vendedor: usr ? { full_name: usr.full_name || usr.email } : null,
                    estado_data: null,
                    actividades: itemActs,
                    activity_summary: computeOpportunityActivitySummary(itemActs)
                };
            });

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
                setLoading(false);
                useSyncStore.getState().setIsLoadingData(false);
            }
            return;
        }

        try {

            let searchAccountIds: string[] = [];
            let searchUserIds: string[] = [];
            // Cuando la búsqueda completa es un celular/teléfono: cuentas cuyo teléfono (o el de alguno de sus contactos) coincide
            const phoneDigits = getCellphoneSearchDigits(searchTerm);
            const searchIsPhone = Boolean(phoneDigits);
            const phoneAccountIds = new Set<string>();
            const phoneContactIds = new Set<string>();

            if (phoneDigits) {
                const matches = await findPhoneMatchesServer(supabase, phoneDigits);
                matches.accountIds.forEach(id => phoneAccountIds.add(id));
                matches.contactIds.forEach(id => phoneContactIds.add(id));
            }
            const serverPhoneMatches: PhoneSearchMatches = { accountIds: phoneAccountIds, contactIds: phoneContactIds };

            if (searchTerm && searchTerm.trim() && !searchIsPhone) {
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

                if (accountsRes.data) searchAccountIds = accountsRes.data.map(a => a.id);
                if (usersRes.data) searchUserIds = usersRes.data.map(u => u.id);
            }

            let collabOppIds: string[] = [];
            if (isVendedor || userFilter === 'collab' || (userFilter === 'all' && userRole !== 'ADMIN')) {
                const { data: collabRows } = await supabase
                    .from('CRM_Oportunidades_Colaboradores')
                    .select('oportunidad_id')
                    .eq('usuario_id', currentUserId)
                    .eq('is_deleted', false);
                collabOppIds = Array.from(new Set((collabRows || []).map(row => row.oportunidad_id).filter(Boolean)));
            }

            const useInnerJoin = Boolean(channelFilter || subclassificationFilter || countryFilter || (cityFilter && cityFilter.trim() !== ''));
            const accountRelation = useInnerJoin ? 'account:CRM_Cuentas!inner(nombre, canal_id, subclasificacion_id, ciudad, pais_id)' : 'account:CRM_Cuentas(nombre, canal_id, subclasificacion_id, ciudad, pais_id)';

            // Builder unificado para aplicar idénticos filtros a la consulta de datos y al conteo de totales
            const applyCommonFilters = (targetQuery: any) => {
                let q = targetQuery.eq('is_deleted', false);

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
                    const tokens = getSearchTokens(searchTerm);
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

                if (channelFilter) {
                    q = q.eq('account.canal_id', channelFilter);
                }

                if (subclassificationFilter) {
                    q = q.eq('account.subclasificacion_id', subclassificationFilter);
                }

                if (statusFilter === 'won') {
                    q = q.in('estado_id', [2, 11]);
                } else if (statusFilter === 'lost') {
                    q = q.in('estado_id', [3, 4, 14]);
                } else if (statusFilter === 'open') {
                    q = q.not('estado_id', 'in', '(2,3,4,11,14)');
                }

                if (segmentFilter) {
                    q = q.eq('segmento_id', segmentFilter);
                }

                if (phaseFilter) {
                    if (phaseFilter === PROSPECTO_PHASE_ID) {
                        q = q.is('fase_id', null);
                    } else {
                        const equivalentIds = getEquivalentPhaseIds(allPhasesRef.current, phaseFilter);
                        if (equivalentIds.length > 1) {
                            q = q.in('fase_id', equivalentIds);
                        } else {
                            q = q.eq('fase_id', equivalentIds[0]);
                        }
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

                if (startDate) {
                    const startISO = toStartOfDayISO(startDate);
                    if (startISO) q = q.gte('created_at', startISO);
                }

                if (endDate) {
                    const endISO = toEndOfDayISO(endDate);
                    if (endISO) q = q.lte('created_at', endISO);
                }

                if (startClosingDate) {
                    const startCloseISO = toStartOfDayISO(startClosingDate);
                    if (startCloseISO) q = q.gte('fecha_cierre_estimada', startCloseISO);
                }

                if (endClosingDate) {
                    const endCloseISO = toEndOfDayISO(endClosingDate);
                    if (endCloseISO) q = q.lte('fecha_cierre_estimada', endCloseISO);
                }

                if (accountOwnerIds && accountOwnerIds.length > 0) {
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
                        if (userRole !== 'ADMIN') {
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
                if (isVendedor && currentUserId) {
                    q = q.or(sellerOpportunityOrFilter(currentUserId, collabOppIds));
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
                    ${accountRelation},
                    fase_data:CRM_FasesOportunidad(nombre),
                    estado_data:CRM_EstadosOportunidad(nombre),
                    vendedor:CRM_Usuarios!owner_user_id(full_name),
                    actividades:CRM_Actividades(id, user_id, fecha_inicio, fecha_fin, tipo_actividad, is_completed, is_deleted)
                `);

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

            // Ejecución en paralelo
            const [{ data: result, error }, totalCount] = await Promise.all([
                dataQuery,
                countPromise
            ]);

            if (error) throw error;

            const pendingChanges = await db.outbox
                .where('entity_type').equals('CRM_Oportunidades')
                .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                .toArray();

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
                    if (isVendedor && currentUserId && !sellerCanSeeOpportunity(o, currentUserId, pendingCollabIds) && o.created_by !== currentUserId) return false;
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

            let combinedResults = [...pendingLocalOpps, ...(result as any[])].map((o: any) => ({
                ...o,
                activity_summary: computeOpportunityActivitySummary(activitiesVisibleToViewer<ActivityItem>(o.actividades, userRole, currentUserId))
            }));
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
            console.error("Error fetching opportunities, executing fallback:", err?.message || err, err?.details, err?.hint, err?.code, JSON.stringify(err));
            try {
                await fetchOffline();
            } catch (fallbackErr) {
                console.error("Fallback error:", fallbackErr);
            }
        } finally {
            setLoading(false);
            useSyncStore.getState().setIsLoadingData(false);
        }
    }, [currentUserId, isVendedor, subordinateIds, pageSize, userFilter, searchTerm, accountIdFilter, accountOwnerIds, userRole, channelFilter, subclassificationFilter, segmentFilter, phaseFilter, statusFilter, originFilter, countryFilter, cityFilter, phasesReady, startDate, endDate, startClosingDate, endClosingDate, sortField, sortAsc]);

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
        setAccountIdFilter,
        setCountryFilter,
        countryFilter,
        setCityFilter,
        cityFilter,
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
