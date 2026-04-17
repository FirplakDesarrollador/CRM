import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { db } from '@/lib/db';

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
    account?: { nombre: string; canal_id?: string } | null; // Joined data
    fase_data?: { nombre: string } | null; // Joined data
    estado_data?: { nombre: string } | null; // Joined data
    vendedor?: { full_name: string } | null; // Joined data
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

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [userFilter, setUserFilter] = useState<'mine' | 'team' | 'collab' | 'all'>('mine');
    const [accountOwnerId, setAccountOwnerId] = useState<string | null>(null);

    // New Hierarchical Filters
    const [channelFilter, setChannelFilter] = useState<string | null>(null);
    const [subclassificationFilter, setSubclassificationFilter] = useState<number | null>(null);
    const [segmentFilter, setSegmentFilter] = useState<number | null>(null);
    const [phaseFilter, setPhaseFilter] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
    const [accountIdFilter, setAccountIdFilter] = useState<string | null>(null);

    // Date Filters
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [startClosingDate, setStartClosingDate] = useState<string | null>(null);
    const [endClosingDate, setEndClosingDate] = useState<string | null>(null);
    
    // Sorting
    const [sortField, setSortField] = useState<string>('updated_at');
    const [sortAsc, setSortAsc] = useState<boolean>(false);

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

        setLoading(true);
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

                // Map helpers
                const accMap = new Map(allAccounts.map(a => [a.id, a]));
                const phaseMap = new Map(allPhases.map(p => [p.id, p]));
                
                // Role filtering for offline
                if (isVendedor && currentUserId) {
                    localOpps = localOpps.filter(o => 
                        o.owner_user_id === currentUserId || 
                        (!o.owner_user_id && o.created_by === currentUserId)
                    );
                }

                // Filtering
                if (searchTerm) {
                    const lowerSearch = searchTerm.toLowerCase();
                    localOpps = localOpps.filter(o => o.nombre.toLowerCase().includes(lowerSearch));
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
                        ![2,3,4,11,14].includes(o.estado_id as number)
                    );
                }

                if (accountIdFilter) {
                    localOpps = localOpps.filter(o => o.account_id === accountIdFilter);
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

                if (accountOwnerId) {
                    localOpps = localOpps.filter(o => o.owner_user_id === accountOwnerId);
                } else {
                    if (userFilter === 'mine') {
                        localOpps = localOpps.filter(o => 
                            o.owner_user_id === currentUserId || 
                            (!o.owner_user_id && o.created_by === currentUserId)
                        );
                    } else if (userFilter === 'collab') {
                        const collabOpps = await db.opportunityCollaborators.where('usuario_id').equals(currentUserId).toArray();
                        const collabOppIds = new Set(collabOpps.map(c => c.oportunidad_id));
                        localOpps = localOpps.filter(o => collabOppIds.has(o.id));
                    } else if (userFilter === 'team' && userRole !== 'ADMIN') {
                        if (userRole === 'COORDINADOR') {
                            localOpps = localOpps.filter(o => o.owner_user_id === currentUserId || (o.owner_user_id && subordinateIds.includes(o.owner_user_id)));
                        } else {
                            localOpps = localOpps.filter(o => o.owner_user_id === currentUserId);
                        }
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

                // Mapping to match server shape
                const flattenedResults = paginatedOpps.map(item => {
                    const acc = accMap.get(item.account_id);
                    const ph = phaseMap.get(item.fase_id as number);
                    return {
                        ...item,
                        account: acc ? { nombre: acc.nombre, canal_id: acc.canal_id } : null,
                        fase_data: ph ? { nombre: ph.nombre } : null,
                        estado_data: null // Mock offline
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

            // Dynamically build select to support filtering on account
            const useInnerJoin = channelFilter || subclassificationFilter;
            const accountRelation = useInnerJoin ? 'account:CRM_Cuentas!inner(nombre, canal_id, subclasificacion_id)' : 'account:CRM_Cuentas(nombre, canal_id, subclasificacion_id)';

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
                    ${accountRelation},
                    fase_data:CRM_FasesOportunidad(nombre),
                    estado_data:CRM_EstadosOportunidad(nombre),
                    vendedor:CRM_Usuarios!owner_user_id(full_name)
                `, { count: 'exact' })
                .eq('is_deleted', false);

            // Apply Filters
            if (searchTerm) {
                query = query.ilike('nombre', `%${searchTerm}%`);
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

            // Status Filter (won/lost/open) - use refs for phase IDs
            if (statusFilter === 'won' && wonPhaseIdsRef.current.length > 0) {
                query = query.in('fase_id', wonPhaseIdsRef.current);
            } else if (statusFilter === 'lost' && lostPhaseIdsRef.current.length > 0) {
                query = query.in('fase_id', lostPhaseIdsRef.current);
            } else if (statusFilter === 'open' && closedPhaseIdsRef.current.length > 0) {
                // Exclude all known closed phases
                query = query.not('fase_id', 'in', `(${closedPhaseIdsRef.current.join(',')})`);
                // Also exclude explicit closed states (11: Cerrado Ganado, 14: Cerrado Perdido, 2: Ganada, 3: Perdida, 4: Cancelada)
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

            if (accountOwnerId) {
                query = query.eq('owner_user_id', accountOwnerId);
            } else {
                if (userFilter === 'mine') {
                    query = query.or(`owner_user_id.eq.${currentUserId},and(owner_user_id.is.null,created_by.eq.${currentUserId})`);
                } else if (userFilter === 'collab') {
                    // Filter by matching in CRM_Oportunidades_Colaboradores
                    // We use inner join to filter results
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
                        ${accountRelation},
                        fase_data:CRM_FasesOportunidad(nombre),
                        estado_data:CRM_EstadosOportunidad(nombre),
                        vendedor:CRM_Usuarios!owner_user_id(full_name),
                        colaboradores:CRM_Oportunidades_Colaboradores!inner(usuario_id)
                    `, { count: 'exact' });
                    query = query.eq('colaboradores.usuario_id', currentUserId);
                } else if (userFilter === 'team') {
                    if (userRole === 'COORDINADOR') {
                        const ids = [currentUserId, ...subordinateIds].filter(Boolean);
                        query = query.in('owner_user_id', ids);
                    } else if (userRole !== 'ADMIN') {
                        query = query.eq('owner_user_id', currentUserId);
                    }
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

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = (result as any[]).filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                pageRef.current = currentPage;
            } else {
                setData(result as any);
                pageRef.current = 1;
            }

            if (totalCount !== null) {
                setCount(totalCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            }

        } catch (err) {
            console.error("Error fetching opportunities:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, subordinateIds, pageSize, userFilter, searchTerm, accountIdFilter, accountOwnerId, userRole, channelFilter, subclassificationFilter, segmentFilter, phaseFilter, statusFilter, phasesReady, startDate, endDate, startClosingDate, endClosingDate, sortField, sortAsc]);

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
        setAccountOwnerId,

        // New Filter Setters
        setChannelFilter,
        setSubclassificationFilter,
        setSegmentFilter,
        setPhaseFilter,
        setStatusFilter,
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
