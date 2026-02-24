import { useState, useEffect, useCallback, useRef } from 'react';
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
    nivel_premium?: 'ORO' | 'PLATA' | 'BRONCE' | null;
    telefono: string | null;
    direccion: string | null;
    ciudad: string | null;
    created_by: string | null;
    owner_user_id?: string | null;
    creator_name?: string | null;
    owner_name?: string | null;
    updated_at: string;
    contact_count?: number;
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

    const pageRef = useRef(1);

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
            const currentPage = isLoadMore ? pageRef.current + 1 : 1;
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
                    nivel_premium,
                    telefono,
                    direccion,
                    ciudad,
                    departamento_id,
                    ciudad_id,
                    created_by,
                    created_at,
                    owner_user_id,
                    updated_at,
                    contacts:CRM_Contactos(count)
                `, { count: 'exact' })
                .eq('is_deleted', false);

            if (searchTerm) {
                query = query.or(`nombre.ilike.%${searchTerm}%,nit_base.ilike.%${searchTerm}%`);
            }

            if (assignedUserId) {
                // Filter by OWNER ID now, not just creator
                // But let's support both or transition?
                // Request says "detect the id of the seller who owns".
                // So filters should probably use owner_user_id.
                // For backward compat, owner_user_id defaults to created_by, so safe to use owner_user_id.
                query = query.eq('owner_user_id', assignedUserId);
            }

            // Order
            query = query.order('updated_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false });

            // Paging
            query = query.range(from, to);

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            console.log(`[useAccountsServer] Fetched ${result?.length} accounts. Order: updated_at DESC`, result?.slice(0, 3));

            // Collect unique owner IDs to resolve names
            const ownerIds = [...new Set(
                (result as any[]).map(item => item.owner_user_id || item.created_by).filter(Boolean)
            )];

            // Fetch owner names from CRM_Usuarios
            let ownerMap: Record<string, string> = {};
            if (ownerIds.length > 0) {
                const { data: usuarios } = await supabase
                    .from('CRM_Usuarios')
                    .select('id, full_name')
                    .in('id', ownerIds);
                if (usuarios) {
                    ownerMap = Object.fromEntries(usuarios.map(u => [u.id, u.full_name || '']));
                }
            }

            const flattenedResults = (result as any[]).map(item => ({
                ...item,
                owner_name: ownerMap[item.owner_user_id] || ownerMap[item.created_by] || null,
                creator_name: ownerMap[item.created_by] || null,
                contact_count: item.contacts?.[0]?.count || 0
            }));

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = flattenedResults.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                setPage(currentPage);
                pageRef.current = currentPage;
            } else {
                setData(flattenedResults as any);
                setPage(1);
                pageRef.current = 1;
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
    }, [currentUserId, pageSize, searchTerm, assignedUserId]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        // Reset page when filters change
        fetchAccounts(false);
    }, [fetchAccounts]);

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
