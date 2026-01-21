import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';

export type AccountServer = {
    id: string;
    nombre: string;
    nit: string | null;
    nit_base: string | null;
    id_cuenta_principal: string | null;
    canal_id: string;
    subclasificacion_id?: number | null;
    es_premium: boolean;
    telefono: string | null;
    direccion: string | null;
    ciudad: string | null;
    created_by: string | null;
    creator_name?: string | null;
    updated_at: string;
};

type UseAccountsServerProps = {
    pageSize?: number;
};

export function useAccountsServer({ pageSize = 20 }: UseAccountsServerProps = {}) {
    const [data, setData] = useState<AccountServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [assignedUserId, setAssignedUserId] = useState<string | null>(null);

    // User Context (needed if we want to filter by permissions, though Accounts are usually global in this CRM)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        syncEngine.getCurrentUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user?.id);
        });
    }, []);

    const fetchAccounts = useCallback(async (isLoadMore = false) => {
        setLoading(true);
        try {
            // Calculate range
            const currentPage = isLoadMore ? page + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('CRM_Cuentas')
                .select(`
                    id, 
                    nombre, 
                    nit,
                    nit_base,
                    id_cuenta_principal,
                    canal_id,
                    subclasificacion_id,
                    es_premium,
                    telefono,
                    direccion,
                    ciudad,
                    created_by,
                    updated_at
                `, { count: 'exact' });

            if (searchTerm) {
                query = query.or(`nombre.ilike.%${searchTerm}%,nit.ilike.%${searchTerm}%`);
            }

            if (assignedUserId) {
                query = query.eq('created_by', assignedUserId);
            }

            // Order
            query = query.order('updated_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false });

            // Paging
            query = query.range(from, to);

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            console.log(`[useAccountsServer] Fetched ${result?.length} accounts. Order: updated_at DESC`, result?.slice(0, 3));

            const flattenedResults = (result as any[]).map(item => ({
                ...item,
                creator_name: item.creator?.full_name || null
            }));

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = flattenedResults.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                setPage(currentPage);
            } else {
                setData(flattenedResults as any);
                setPage(1);
            }

            if (totalCount !== null) {
                setCount(totalCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            }

        } catch (err) {
            console.error("Error fetching accounts:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, pageSize, searchTerm, assignedUserId, page]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        // Reset page when filters change
        fetchAccounts(false);
    }, [searchTerm, assignedUserId, fetchAccounts]); // Added fetchAccounts here

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchAccounts(true);
        }
    };

    return {
        data,
        count,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setAssignedUserId,
        refresh: () => fetchAccounts(false)
    };
}
