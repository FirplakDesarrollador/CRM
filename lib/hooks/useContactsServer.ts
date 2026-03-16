import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export type ContactServer = {
    id: string;
    account_id: string;
    nombre: string;
    cargo?: string;
    email?: string;
    telefono?: string;
    es_principal: boolean;
    created_at?: string;
    created_by?: string;
    updated_at: string;
    account_name?: string | null;
    _hasPendingSync?: boolean;
};

type UseContactsServerProps = {
    pageSize?: number;
    accountId?: string;
};

export function useContactsServer({ pageSize = 20, accountId }: UseContactsServerProps = {}) {
    const [data, setData] = useState<ContactServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const pageRef = useRef(1);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");

    // User Context
    const { user, isVendedor } = useCurrentUser();
    const currentUserId = user?.id;

    const fetchContacts = useCallback(async (isLoadMore = false) => {
        setLoading(true);
        try {
            // Calculate range
            const currentPage = isLoadMore ? pageRef.current + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            if (!navigator.onLine) {
                console.log("[useContactsServer] Device is offline. Falling back to local Dexie database...");
                let localContacts = await db.contacts.toArray();
                
                if (accountId) {
                    localContacts = localContacts.filter(c => c.account_id === accountId);
                }

                // Filtering
                if (searchTerm) {
                    const lowerSearch = searchTerm.toLowerCase();
                    localContacts = localContacts.filter(c => 
                        c.nombre.toLowerCase().includes(lowerSearch) ||
                        (c.email && c.email.toLowerCase().includes(lowerSearch))
                    );
                }

                // Sorting
                localContacts.sort((a, b) => {
                    const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                    const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    return dateB - dateA; // DESC
                });

                const totalCount = localContacts.length;
                const paginatedContacts = localContacts.slice(from, to + 1);

                if (isLoadMore) {
                    setData(prev => {
                        const existingIds = new Set(prev.map(i => i.id));
                        const newItems = paginatedContacts.filter(i => !existingIds.has(i.id));
                        return [...prev, ...newItems] as any;
                    });
                    setPage(currentPage);
                    pageRef.current = currentPage;
                } else {
                    setData(paginatedContacts as any);
                    setPage(1);
                    pageRef.current = 1;
                }
                setCount(totalCount);
                setHasMore(from + paginatedContacts.length < totalCount);
                return;
            }

            // Build query
            const selectFields = `
                id,
                account_id,
                nombre,
                cargo,
                email,
                telefono,
                es_principal,
                created_at,
                created_by,
                updated_at,
                account:CRM_Cuentas(nombre)
            `;

            let query = supabase
                .from('CRM_Contactos')
                .select(selectFields, { count: 'exact' })
                .eq('is_deleted', false);

            if (accountId) {
                query = query.eq('account_id', accountId);
            }

            if (searchTerm) {
                query = query.or(`nombre.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
            }

            // Order
            query = query.order('updated_at', { ascending: false }).order('id', { ascending: false });

            // Paging
            query = query.range(from, to);

            // Fetch pending local changes
            const pendingChanges = await db.outbox
                .where('entity_type').equals('CRM_Contactos')
                .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                .toArray();

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            const resultIds = result ? (result as any[]).map(r => r.id) : [];
            const optimisticUpdates: Record<string, Record<string, any>> = {};
            for (const change of pendingChanges) {
                if (resultIds.includes(change.entity_id)) {
                    if (!optimisticUpdates[change.entity_id]) {
                        optimisticUpdates[change.entity_id] = {};
                    }
                    optimisticUpdates[change.entity_id][change.field_name] = change.new_value;
                }
            }

            const flattenedResults = (result as any[]).map(item => {
                const pending = optimisticUpdates[item.id];
                const finalItem = pending ? { ...item, ...pending, _hasPendingSync: true } : item;
                
                return {
                    ...finalItem,
                    cargo: finalItem.cargo || undefined,
                    email: finalItem.email || undefined,
                    telefono: finalItem.telefono || undefined,
                    account_name: finalItem.account?.nombre || null
                };
            });

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
            console.error("Error fetching contacts:", err);
        } finally {
            setLoading(false);
        }
    }, [pageSize, searchTerm, accountId]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        fetchContacts(false);
    }, [fetchContacts]);

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchContacts(true);
        }
    };

    return {
        data,
        count,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        refresh: () => fetchContacts(false)
    };
}
