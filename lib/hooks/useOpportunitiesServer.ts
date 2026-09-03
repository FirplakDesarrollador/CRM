import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { db } from '@/lib/db';
import { useSyncStore } from '@/lib/stores/useSyncStore';
import { matchesSearchTokens, getSearchTokens } from '@/lib/utils';
import { computeOpportunityActivitySummary, OpportunityActivitySummary } from '@/lib/opportunityActivities';

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
    actividades?: Array<{ id: string; fecha_fin?: string | null; is_completed?: boolean; is_deleted?: boolean }> | null;
    activity_summary?: OpportunityActivitySummary;
};

type StatusFilter = 'all' | 'open' | 'won' | 'lost';

type UseOpportunitiesServerProps = {
    pageSize?: number;
    initialStatus?: string;
};

export function useOpportunitiesServer({ pageSize = 20 }: UseOpportunitiesServerProps = {}) {
    const [data, setData] = useState<OpportunityServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [hasMore, setHasMore] = useState<boolean>(true);

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
    const [userFilter, setUserFilter] = useState<'mine' | 'team' | 'collab' | 'all' | 'unrestricted' | 'web'>(() => (getInitialParam('tab') as any) || 'all');
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
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => (getInitialParam('status') as any) || 'open');
    const [originFilter, setOriginFilter] = useState<string | null>(() => getInitialParam('origin'));
    const [accountIdFilter, setAccountIdFilter] = useState<string | null>(null);

    // Date Filters
    const [startDate, setStartDate] = useState<string | null>(() => getInitialParam('start'));
    const [endDate, setEndDate] = useState<string | null>(() => getInitialParam('end'));
    const [startClosingDate, setStartClosingDate] = useState<string | null>(() => getInitialParam('startClose'));
    const [endClosingDate, setEndClosingDate] = useState<string | null>(() => getInitialParam('endClose'));

    // Sorting
    const [sortField, setSortField] = useState<string>(() => getInitialParam('sort') || 'updated_at');
    const [sortAsc, setSortAsc] = useState<boolean>(() => getInitialParam('dir') === 'asc');

    // PERF FIX: Phase IDs only stored in refs (not state) to avoid triggering refetches
    const wonPhaseIdsRef = useRef<number[]>([]);
    const lostPhaseIdsRef = useRef<number[]>([]);
    const closedPhaseIdsRef = useRef<number[]>([]);
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
            let phases: any[] = [];

            if (!navigator.onLine) {
                const localPhases = await db.phases.toArray();
                phases = localPhases;
            } else {
                const { data } = await supabase
                    .from('CRM_FasesOportunidad')
                    .select('id, nombre')
                    .eq('is_active', true);
                if (data) phases = data;
            }

            if (phases && phases.length > 0) {
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
        try {
            // Calculate range using ref
            const currentPage = isLoadMore ? pageRef.current + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            if (!navigator.onLine) {
                console.log("[useOpportunitiesServer] Device is offline. Falling back to local Dexie database...");
                let localOpps = await db.opportunities.toArray();
                const allAccounts = await db.accounts.toArray();
                const allPhases = await db.phases.toArray();
                const { data: usersData } = await supabase.from('CRM_Usuarios').select('id, full_name, email');

                // Map helpers
                const accMap = new Map(allAccounts.map(a => [a.id, a]));
                const userMap = new Map((usersData || []).map(u => [u.id, u]));
                const phaseMap = new Map(allPhases.map(p => [p.id, p]));

                // Role filtering for offline
                if (isVendedor && currentUserId) {
                    localOpps = localOpps.filter(o =>
                        o.owner_user_id === currentUserId ||
                        (!o.owner_user_id && o.created_by === currentUserId)
                    );
                }

                // Filtering
                if (searchTerm && searchTerm.trim()) {
                    localOpps = localOpps.filter(o =>
                        matchesSearchTokens([
                            o.nombre,
                            accMap.get(o.account_id)?.nombre,
                            (o as any).vendedor?.full_name,
                            o.origen_oportunidad
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
                    localOpps = localOpps.filter(o => o.fase_id === phaseFilter);
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

                if (originFilter) {
                    const lowerOrigin = originFilter.toLowerCase();
                    localOpps = localOpps.filter(o => {
                        if (!o.origen_oportunidad) return false;
                        const val = o.origen_oportunidad.toLowerCase();
                        if (lowerOrigin === 'wp') {
                            return val.includes('wp') || val.includes('whatsapp');
                        }
                        return val.includes(lowerOrigin);
                    });
                }

                // Date Filters offline
                if (startDate) {
                    localOpps = localOpps.filter(o => o.created_at && new Date(o.created_at) >= new Date(startDate));
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    localOpps = localOpps.filter(o => o.created_at && new Date(o.created_at) <= end);
                }
                if (startClosingDate) {
                    localOpps = localOpps.filter(o => o.fecha_cierre_estimada && new Date(o.fecha_cierre_estimada) >= new Date(startClosingDate));
                }
                if (endClosingDate) {
                    const end = new Date(endClosingDate);
                    end.setHours(23, 59, 59, 999);
                    localOpps = localOpps.filter(o => o.fecha_cierre_estimada && new Date(o.fecha_cierre_estimada) <= end);
                }

                if (accountOwnerIds && accountOwnerIds.length > 0) {
                    localOpps = localOpps.filter(o => o.owner_user_id && accountOwnerIds.includes(o.owner_user_id));
                }

                if (userFilter !== 'unrestricted') {
                    if (userFilter === 'mine') {
                        localOpps = localOpps.filter(o =>
                            o.owner_user_id === currentUserId ||
                            (!o.owner_user_id && o.created_by === currentUserId)
                        );
                    } else if (userFilter === 'collab') {
                        const myCollabOpps = await db.opportunityCollaborators.where('usuario_id').equals(currentUserId).toArray();
                        const myCollabOppIds = new Set(myCollabOpps.map(c => c.oportunidad_id));

                        const allCollabOpps = await db.opportunityCollaborators.toArray();
                        const anyCollabOppIds = new Set(allCollabOpps.map(c => c.oportunidad_id));

                        localOpps = localOpps.filter(o =>
                            myCollabOppIds.has(o.id) || (o.owner_user_id === currentUserId && anyCollabOppIds.has(o.id))
                        );
                    } else if (userFilter === 'all') {
                        if (userRole !== 'ADMIN') {
                            const collabOpps = await db.opportunityCollaborators.where('usuario_id').equals(currentUserId).toArray();
                            const collabOppIds = new Set(collabOpps.map(c => c.oportunidad_id));
                            localOpps = localOpps.filter(o =>
                                o.owner_user_id === currentUserId ||
                                (!o.owner_user_id && o.created_by === currentUserId) ||
                                collabOppIds.has(o.id)
                            );
                        }
                    } else if (userFilter === 'team' && userRole !== 'ADMIN') {
                        if (userRole === 'COORDINADOR') {
                            localOpps = localOpps.filter(o => o.owner_user_id === currentUserId || (o.owner_user_id && subordinateIds.includes(o.owner_user_id)));
                        } else {
                            localOpps = localOpps.filter(o => o.owner_user_id === currentUserId);
                        }
                    } else if (userFilter === 'web') {
                        localOpps = localOpps.filter(o => o.origen_oportunidad && o.origen_oportunidad.toLowerCase().includes('web'));
                    }
                }

                // Sorting
                localOpps.sort((a, b) => {
                    let valA: any;
                    let valB: any;

                    if (sortField === 'nombre') {
                        valA = a.nombre || "";
                        valB = b.nombre || "";
                    } else if (sortField === 'amount') {
                        valA = a.amount || 0;
                        valB = b.amount || 0;
                    } else if (sortField === 'fecha_cierre_estimada') {
                        valA = a.fecha_cierre_estimada ? new Date(a.fecha_cierre_estimada).getTime() : 0;
                        valB = b.fecha_cierre_estimada ? new Date(b.fecha_cierre_estimada).getTime() : 0;
                    } else if (sortField === 'created_at') {
                        valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    } else if (sortField === 'account_nombre') {
                        valA = accMap.get(a.account_id)?.nombre || "";
                        valB = accMap.get(b.account_id)?.nombre || "";
                    } else {
                        valA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                        valB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    }

                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });

                const totalCount = localOpps.length;
                const paginatedOpps = localOpps.slice(from, to + 1);
                const oppIds = paginatedOpps.map(i => i.id);
                const localActs = await db.activities.where('opportunity_id').anyOf(oppIds).toArray();
                const actsByOpp = new Map<string, any[]>();
                localActs.forEach(act => {
                    if (act.opportunity_id) {
                        const list = actsByOpp.get(act.opportunity_id) || [];
                        list.push(act);
                        actsByOpp.set(act.opportunity_id, list);
                    }
                });

                // Mapping to match server shape
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
                        estado_data: null, // Mock offline
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
                return;
            }

            // Resolve search term against accounts and users to allow cross-table filtering
            let searchAccountIds: string[] = [];
            let searchUserIds: string[] = [];

            if (searchTerm && searchTerm.trim()) {
                const tokens = getSearchTokens(searchTerm);
                let accQuery = supabase.from('CRM_Cuentas').select('id').eq('is_deleted', false);
                let userQuery = supabase.from('CRM_Usuarios').select('id');
                for (const token of tokens) {
                    accQuery = accQuery.ilike('nombre', `%${token}%`);
                    userQuery = userQuery.ilike('full_name', `%${token}%`);
                }
                const [accountsRes, usersRes] = await Promise.all([
                    accQuery.limit(100),
                    userQuery.limit(100)
                ]);

                if (accountsRes.data) searchAccountIds = accountsRes.data.map(a => a.id);
                if (usersRes.data) searchUserIds = usersRes.data.map(u => u.id);
            }

            // Dynamically build select to support filtering on account
            const useInnerJoin = channelFilter || subclassificationFilter;
            const accountRelation = useInnerJoin ? 'account:CRM_Cuentas!inner(nombre, canal_id, subclasificacion_id, ciudad, pais_id)' : 'account:CRM_Cuentas(nombre, canal_id, subclasificacion_id, ciudad, pais_id)';

            let query = supabase
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
                    ${accountRelation},
                    fase_data:CRM_FasesOportunidad(nombre),
                    estado_data:CRM_EstadosOportunidad(nombre),
                    vendedor:CRM_Usuarios(full_name),
                    actividades:CRM_Actividades(id, fecha_fin, is_completed, is_deleted)
                `, { count: 'exact' })
                .eq('is_deleted', false);

            // Apply Filters
            if (searchTerm && searchTerm.trim()) {
                const tokens = getSearchTokens(searchTerm);
                for (const token of tokens) {
                    let orConditions = [`nombre.ilike.%${token}%`];
                    if (searchAccountIds.length > 0) {
                        orConditions.push(`account_id.in.(${searchAccountIds.join(',')})`);
                    }
                    if (searchUserIds.length > 0) {
                        orConditions.push(`owner_user_id.in.(${searchUserIds.join(',')})`);
                    }
                    query = query.or(orConditions.join(','));
                }
            }

            // Hierarchical Filters
            if (channelFilter) {
                query = query.eq('account.canal_id', channelFilter);
            }

            if (subclassificationFilter) {
                query = query.eq('account.subclasificacion_id', subclassificationFilter);
            }

            if (segmentFilter) {
                query = query.eq('segmento_id', segmentFilter);
            }

            if (phaseFilter) {
                query = query.eq('fase_id', phaseFilter);
            }

            if (originFilter) {
                if (originFilter.toLowerCase() === 'wp') {
                    query = query.or('origen_oportunidad.ilike.%wp%,origen_oportunidad.ilike.%whatsapp%');
                } else {
                    query = query.ilike('origen_oportunidad', `%${originFilter}%`);
                }
            }

            // Status Filter (won/lost/open) - avoid duplicate top-level PostgREST .or() calls
            if (statusFilter === 'won') {
                query = query.in('estado_id', [2, 11]);
            } else if (statusFilter === 'lost') {
                query = query.in('estado_id', [3, 4, 14]);
            } else if (statusFilter === 'open') {
                query = query.not('estado_id', 'in', '(2,3,4,11,14)');
            }

            if (accountIdFilter) {
                query = query.eq('account_id', accountIdFilter);
            }

            // Date Filters
            if (startDate) {
                query = query.gte('created_at', startDate);
            }
            if (endDate) {
                // To include the whole day
                query = query.lte('created_at', `${endDate}T23:59:59`);
            }
            if (startClosingDate) {
                query = query.gte('fecha_cierre_estimada', startClosingDate);
            }
            if (endClosingDate) {
                query = query.lte('fecha_cierre_estimada', `${endClosingDate}T23:59:59`);
            }

            if (accountOwnerIds && accountOwnerIds.length > 0) {
                query = query.in('owner_user_id', accountOwnerIds);
            } else if (userFilter !== 'unrestricted') {
                if (userFilter === 'mine') {
                    const ids = [currentUserId].filter(Boolean);
                    const idsString = ids.join(',');
                    query = query.or(`owner_user_id.in.(${idsString}),and(owner_user_id.is.null,created_by.in.(${idsString}))`);
                } else if (userFilter === 'collab') {
                    // We want opportunities that have collaboration AND the user is involved (either as owner or as collaborator)
                    const { data: collabRows } = await supabase
                        .from('CRM_Oportunidades_Colaboradores')
                        .select('oportunidad_id')
                        .eq('usuario_id', currentUserId);
                    const collabOppIds = Array.from(new Set((collabRows || []).map(row => row.oportunidad_id).filter(Boolean)));

                    query = query.select(`
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
                        ${accountRelation},
                        fase_data:CRM_FasesOportunidad(nombre),
                        estado_data:CRM_EstadosOportunidad(nombre),
                        vendedor:CRM_Usuarios!owner_user_id(full_name),
                        colaboradores:CRM_Oportunidades_Colaboradores!inner(usuario_id),
                        actividades:CRM_Actividades(id, fecha_fin, is_completed, is_deleted)
                    `);

                    const ownershipConditions = [
                        `owner_user_id.eq.${currentUserId}`
                    ];
                    if (collabOppIds.length > 0) {
                        ownershipConditions.push(`id.in.(${collabOppIds.join(',')})`);
                    }
                    query = query.or(ownershipConditions.join(','));
                } else if (userFilter === 'all') {
                    if (userRole !== 'ADMIN') {
                        const ids = userRole === 'COORDINADOR' ? [currentUserId, ...subordinateIds].filter(Boolean) : [currentUserId].filter(Boolean);
                        const idsString = ids.join(',');
                        const { data: collabRows } = await supabase
                            .from('CRM_Oportunidades_Colaboradores')
                            .select('oportunidad_id')
                            .eq('usuario_id', currentUserId);
                        const collabOppIds = Array.from(new Set((collabRows || []).map(row => row.oportunidad_id).filter(Boolean)));
                        const ownershipConditions = [
                            `owner_user_id.in.(${idsString})`,
                            `and(owner_user_id.is.null,created_by.in.(${idsString}))`
                        ];
                        if (collabOppIds.length > 0) {
                            ownershipConditions.push(`id.in.(${collabOppIds.join(',')})`);
                        }
                        query = query.or(ownershipConditions.join(','));
                    }
                } else if (userFilter === 'team') {
                    if (userRole === 'COORDINADOR') {
                        const ids = [currentUserId, ...subordinateIds].filter(Boolean);
                        query = query.in('owner_user_id', ids);
                    } else if (userRole !== 'ADMIN') {
                        const ids = [currentUserId].filter(Boolean);
                        query = query.in('owner_user_id', ids);
                    }
                } else if (userFilter === 'web') {
                    query = query.or('url_origen.not.is.null,origen_oportunidad.ilike.%web%,origen_oportunidad.ilike.%pagina%');
                }
            }

            // Order
            if (sortField === 'account_nombre') {
                query = query.order('nombre', { foreignTable: 'CRM_Cuentas', ascending: sortAsc });
            } else if (sortField === 'vendedor_nombre') {
                query = query.order('full_name', { foreignTable: 'CRM_Usuarios', ascending: sortAsc });
            } else {
                query = query.order(sortField as any, { ascending: sortAsc });
            }

            // Paging
            query = query.range(from, to);

            const { data: result, error, count: totalCount } = await query;

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
                pendingLocalOpps = localOpps.filter((o: any) => {
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
                activity_summary: o.activity_summary || computeOpportunityActivitySummary(o.actividades)
            }));
            if (searchTerm && searchTerm.trim()) {
                combinedResults = combinedResults.filter(o =>
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
                const effectiveCount = (searchTerm && searchTerm.trim()) ? combinedResults.length : totalCount;
                setCount(effectiveCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            }

        } catch (err) {
            console.error("Error fetching opportunities:", err);
            try {
                let localOpps = await db.opportunities.toArray();
                const allAccounts = await db.accounts.toArray();
                const allPhases = await db.phases.toArray();
                const { data: usersData } = await supabase.from('CRM_Usuarios').select('id, full_name, email');
                const accMap = new Map(allAccounts.map(a => [a.id, a]));
                const userMap = new Map((usersData || []).map(u => [u.id, u]));
                const phaseMap = new Map(allPhases.map(p => [p.id, p]));

                if (searchTerm && searchTerm.trim()) {
                    localOpps = localOpps.filter(o => matchesSearchTokens([
                        o.nombre,
                        accMap.get(o.account_id)?.nombre,
                        userMap.get(o.owner_user_id || '')?.full_name
                    ], searchTerm));
                }
                if (accountOwnerIds && accountOwnerIds.length > 0) {
                    localOpps = localOpps.filter(o => o.owner_user_id && accountOwnerIds.includes(o.owner_user_id));
                }

                const mappedOpps = localOpps.map(item => {
                    const acc = accMap.get(item.account_id);
                    const ph = phaseMap.get(item.fase_id as number);
                    const usr = userMap.get(item.owner_user_id || '');
                    return {
                        ...item,
                        account: acc ? { nombre: acc.nombre, canal_id: acc.canal_id, ciudad: acc.ciudad, pais_id: acc.pais_id } : null,
                        fase_data: ph ? { nombre: ph.nombre } : null,
                        vendedor: usr ? { full_name: usr.full_name || usr.email } : null,
                        estado_data: null
                    };
                });

                setData(mappedOpps as any);
                setCount(mappedOpps.length);
            } catch (fallbackErr) {
                console.error("Fallback error:", fallbackErr);
            }
        } finally {
            setLoading(false);
            useSyncStore.getState().setIsLoadingData(false);
        }
    }, [currentUserId, subordinateIds, pageSize, userFilter, searchTerm, accountIdFilter, accountOwnerIds, userRole, channelFilter, subclassificationFilter, segmentFilter, phaseFilter, statusFilter, originFilter, phasesReady, startDate, endDate, startClosingDate, endClosingDate, sortField, sortAsc]);

    // Initial Fetch & Filter Fetch - no longer depends on phase IDs (read from refs)
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
