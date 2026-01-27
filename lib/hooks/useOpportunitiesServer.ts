import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';
import { useSyncStore } from '@/lib/stores/useSyncStore';

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
    fecha_cierre_estimada?: string | null;
    segmento_id?: number | null;
    account?: { nombre: string; canal_id?: string } | null; // Joined data
    fase_data?: { nombre: string } | null; // Joined data
    estado_data?: { nombre: string } | null; // Joined data
};

type UseOpportunitiesServerProps = {
    pageSize?: number;
    initialStatus?: string;
};

export function useOpportunitiesServer({ pageSize = 20 }: UseOpportunitiesServerProps = {}) {
    const [data, setData] = useState<OpportunityServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [userFilter, setUserFilter] = useState<'mine' | 'team' | 'all'>('mine');
    const [accountOwnerId, setAccountOwnerId] = useState<string | null>(null);

    // New Hierarchical Filters
    const [channelFilter, setChannelFilter] = useState<string | null>(null);
    const [segmentFilter, setSegmentFilter] = useState<number | null>(null);
    const [phaseFilter, setPhaseFilter] = useState<number | null>(null);

    // User Context
    const { userRole } = useSyncStore();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        syncEngine.getCurrentUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user?.id);
        });
    }, []);

    const fetchOpportunities = useCallback(async (isLoadMore = false) => {
        if (!currentUserId) return; // Wait for user

        setLoading(true);
        try {
            // Calculate range
            const currentPage = isLoadMore ? page + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            // Dynamically build select to support filtering on account
            const accountRelation = channelFilter ? 'account:CRM_Cuentas!inner(nombre, canal_id)' : 'account:CRM_Cuentas(nombre, canal_id)';

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
                    fecha_cierre_estimada,
                    segmento_id,
                    ${accountRelation},
                    fase_data:CRM_FasesOportunidad(nombre),
                    estado_data:CRM_EstadosOportunidad(nombre)
                `, { count: 'exact' })
                .eq('is_deleted', false);

            // Apply Filters
            if (searchTerm) {
                query = query.ilike('nombre', `%${searchTerm}%`);
            }

            // Hierarchical Filters
            if (channelFilter) {
                // Filter by Channel (inherited from Account)
                query = query.eq('account.canal_id', channelFilter);
            }

            if (segmentFilter) {
                // Filter by Segment
                query = query.eq('segmento_id', segmentFilter);
            }

            if (phaseFilter) {
                // Filter by Phase
                query = query.eq('fase_id', phaseFilter);
            }

            if (accountOwnerId) {
                // Filtramos por el dueño de la oportunidad (owner_user_id)
                query = query.eq('owner_user_id', accountOwnerId);
            } else {
                // Solo aplicamos el filtro de pestaña si no hay un usuario específico seleccionado
                if (userFilter === 'mine') {
                    query = query.eq('owner_user_id', currentUserId);
                } else if (userFilter === 'team') {
                    if (userRole !== 'ADMIN') {
                        query = query.eq('owner_user_id', currentUserId);
                    }
                }
            }

            // Order
            query = query.order('updated_at', { ascending: false });

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
                setPage(currentPage);
            } else {
                setData(result as any);
                setPage(1);
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
    }, [currentUserId, pageSize, userFilter, searchTerm, accountOwnerId, userRole, page, channelFilter, segmentFilter, phaseFilter]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        // Reset page when filters change
        fetchOpportunities(false);
    }, [userFilter, searchTerm, accountOwnerId, currentUserId, channelFilter, segmentFilter, phaseFilter]);

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
        setSegmentFilter,
        setPhaseFilter,

        refresh: () => fetchOpportunities(false)
    };
}
