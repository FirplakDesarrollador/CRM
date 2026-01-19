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
    account?: { nombre: string } | null; // Joined data
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
                    account:CRM_Cuentas(nombre)
                `, { count: 'exact' });

            // Apply Filters
            if (searchTerm) {
                // If we had the global search or a text index on opportunity name
                // Ideally this should use an OR on account name too, but Supabase standard OR syntax is tricky with joins.
                // For performance, we'll start with filtering on Opportunity Name ONLY or use the RPC search if complex.
                // Simple ILIKE on name:
                query = query.ilike('nombre', `%${searchTerm}%`);
            }

            if (userFilter === 'mine') {
                query = query.eq('owner_user_id', currentUserId);
            } else if (userFilter === 'team') {
                // Admin sees all, but maybe we want to filter by specific team members later?
                // For now 'team' implies everything if ADMIN
                if (userRole !== 'ADMIN') {
                    // CAUTION: Fallback for non-admins trying to see team
                    query = query.eq('owner_user_id', currentUserId);
                }
            }

            if (accountOwnerId) {
                // Filter by owner of the associated account
                // Note: We use the alias 'account' from the join CRM_Cuentas
                // But Supabase query filter on joined tables uses the dot notation.
                query = query.eq('CRM_Cuentas.created_by', accountOwnerId);
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
                // Check if we reached the end
                // If we requested range 0-19 (20 items) and got 20, we assume there might be more.
                // Or compare with totalCount.
                setHasMore(from + (result?.length || 0) < totalCount);
            }

        } catch (err) {
            console.error("Error fetching opportunities:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, pageSize, userFilter, searchTerm, accountOwnerId, userRole, page]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        // Reset page when filters change
        fetchOpportunities(false);
    }, [userFilter, searchTerm, accountOwnerId, currentUserId]);
    // Note: removed fetchOpportunities from dep array to avoid loops, but added filters. 
    // However, fetchOpportunities depends on 'page' which is updated inside... 
    // We should separate "reset" from "load more".

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
        refresh: () => fetchOpportunities(false)
    };
}
