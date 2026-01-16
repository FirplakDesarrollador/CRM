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
    es_premium: boolean;
    telefono: string | null;
    direccion: string | null;
    ciudad: string | null;
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
                    es_premium,
                    telefono,
                    direccion,
                    ciudad,
                    updated_at
                `, { count: 'exact' });

            // Apply Filters
            if (searchTerm) {
                query = query.or(`nombre.ilike.%${searchTerm}%,nit.ilike.%${searchTerm}%`);
            }

            // Order
            query = query.order('nombre', { ascending: true }); // Alphabetical for accounts usually makes sense

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
            console.error("Error fetching accounts:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, pageSize, searchTerm, page]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        // Reset page when filters change
        fetchAccounts(false);
    }, [searchTerm]);

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
        refresh: () => fetchAccounts(false)
    };
}
