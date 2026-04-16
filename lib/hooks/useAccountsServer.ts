import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';
import { db } from '@/lib/db';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

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
    email: string | null;
    direccion: string | null;
    ciudad: string | null;
    created_by: string | null;
    owner_user_id?: string | null;
    creator_name?: string | null;
    owner_name?: string | null;
    updated_at: string;
    created_at: string;
    contact_count?: number;
    potencial_venta?: number;
    _hasPendingSync?: boolean;
};

type UseAccountsServerProps = {
    pageSize?: number;
};

export function useAccountsServer({ pageSize = 20 }: UseAccountsServerProps = {}) {
    const [data, setData] = useState<AccountServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [hasMore, setHasMore] = useState<boolean>(true);

    const pageRef = useRef(1);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
    const [channelFilter, setChannelFilter] = useState<string | null>(null);
    const [subclassificationFilter, setSubclassificationFilter] = useState<number | null>(null);
    const [nivelPremiumFilter, setNivelPremiumFilter] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);

    // Sorting
    const [sortField, setSortField] = useState<string>('updated_at');
    const [sortAsc, setSortAsc] = useState<boolean>(false);

    // User Context
    const { user, role: userRole, isVendedor } = useCurrentUser();
    const currentUserId = user?.id;

    const [subordinateIds, setSubordinateIds] = useState<string[]>([]);

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

    const fetchAccounts = useCallback(async (isLoadMore = false) => {
        setLoading(true);
        try {
            // Calculate range
            const currentPage = isLoadMore ? pageRef.current + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            if (!navigator.onLine) {
                console.log("[useAccountsServer] Device is offline. Falling back to local Dexie database...");
                let localAccounts = await db.accounts.toArray();
                const allOpps = await db.opportunities.toArray();

                // Role filtering
                if (isVendedor && currentUserId) {
                    localAccounts = localAccounts.filter((a: any) => 
                        a.owner_user_id === currentUserId || 
                        (!a.owner_user_id && a.created_by === currentUserId)
                    );
                } else if (userRole === 'COORDINADOR' && currentUserId) {
                    localAccounts = localAccounts.filter((a: any) => 
                        a.owner_user_id === currentUserId || 
                        (!a.owner_user_id && a.created_by === currentUserId) ||
                        (a.owner_user_id && subordinateIds.includes(a.owner_user_id)) ||
                        (!a.owner_user_id && a.created_by && subordinateIds.includes(a.created_by))
                    );
                }

                // Filters
                if (searchTerm) {
                    const lowerSearch = searchTerm.toLowerCase();
                    localAccounts = localAccounts.filter(a =>
                        a.nombre.toLowerCase().includes(lowerSearch) ||
                        (a.nit_base && a.nit_base.toLowerCase().includes(lowerSearch))
                    );
                }

                if (assignedUserId) {
                    localAccounts = localAccounts.filter(a => a.owner_user_id === assignedUserId);
                }

                if (channelFilter) {
                    localAccounts = localAccounts.filter(a => a.canal_id === channelFilter);
                }

                if (subclassificationFilter) {
                    localAccounts = localAccounts.filter(a => a.subclasificacion_id === subclassificationFilter);
                }

                if (nivelPremiumFilter) {
                    localAccounts = localAccounts.filter(a => a.nivel_premium === nivelPremiumFilter);
                }

                if (startDate) {
                    localAccounts = localAccounts.filter(a => a.created_at && new Date(a.created_at) >= new Date(startDate));
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    localAccounts = localAccounts.filter(a => a.created_at && new Date(a.created_at) <= end);
                }

                // Sorting offline
                localAccounts.sort((a, b) => {
                    let valA: any;
                    let valB: any;

                    if (sortField === 'nombre') {
                        valA = a.nombre || "";
                        valB = b.nombre || "";
                    } else if (sortField === 'nit') {
                        valA = a.nit_base || "";
                        valB = b.nit_base || "";
                    } else if (sortField === 'canal_id') {
                        valA = a.canal_id || "";
                        valB = b.canal_id || "";
                    } else if (sortField === 'ciudad') {
                        valA = a.ciudad || "";
                        valB = b.ciudad || "";
                    } else if (sortField === 'potencial_venta') {
                        valA = a.potencial_venta || 0;
                        valB = b.potencial_venta || 0;
                    } else if (sortField === 'created_at') {
                        valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    } else {
                        valA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                        valB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    }

                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });

                const totalCount = localAccounts.length;
                const paginatedAccounts = localAccounts.slice(from, to + 1);

                const flattenedResults = paginatedAccounts.map(item => ({
                    ...item,
                    owner_name: 'Usuario Offline',
                    creator_name: 'Usuario Offline',
                    contact_count: 0,
                    potencial_venta: allOpps
                        .filter(o => o.account_id === item.id)
                        .reduce((sum, o) => sum + (o.amount || o.valor || 0), 0)
                }));

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
                setHasMore(from + paginatedAccounts.length < totalCount);
                return;
            }

            let query = supabase
                .from('CRM_VistaCuentasConPotencial')
                .select('*', { count: 'exact' })
                .eq('is_deleted', false);

            // Role filtering
            if (isVendedor && currentUserId) {
                query = query.or(`owner_user_id.eq.${currentUserId},and(owner_user_id.is.null,created_by.eq.${currentUserId})`);
            } else if (userRole === 'COORDINADOR' && currentUserId) {
                const ids = [currentUserId, ...subordinateIds].filter(Boolean);
                const idsString = ids.join(',');
                query = query.or(`owner_user_id.in.(${idsString}),and(owner_user_id.is.null,created_by.in.(${idsString}))`);
            }

            if (searchTerm) {
                query = query.or(`nombre.ilike.%${searchTerm}%,nit_base.ilike.%${searchTerm}%`);
            }

            if (assignedUserId) {
                query = query.eq('owner_user_id', assignedUserId);
            }

            if (channelFilter) {
                query = query.eq('canal_id', channelFilter);
            }

            if (subclassificationFilter) {
                query = query.eq('subclasificacion_id', subclassificationFilter);
            }

            if (nivelPremiumFilter) {
                query = query.eq('nivel_premium', nivelPremiumFilter);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }
            if (endDate) {
                query = query.lte('created_at', `${endDate}T23:59:59`);
            }

            // Order
            query = query.order(sortField as any, { ascending: sortAsc });
            if (sortField !== 'id') query = query.order('id', { ascending: false });

            // Paging
            query = query.range(from, to);

            const pendingChanges = await db.outbox
                .where('entity_type').equals('CRM_Cuentas')
                .and(item => item.status === 'PENDING' || item.status === 'SYNCING')
                .toArray();

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            // Collect unique owner IDs to resolve names
            const ownerIds = [...new Set(
                (result as any[]).map(item => item.owner_user_id || item.created_by).filter(Boolean)
            )];

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

            // Group changes by entity_id for successful queries
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
                    owner_name: ownerMap[finalItem.owner_user_id] || ownerMap[finalItem.created_by] || null,
                    creator_name: ownerMap[finalItem.created_by] || null,
                    contact_count: finalItem.contact_count || 0,
                    potencial_venta: finalItem.potencial_venta || 0
                };
            });

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = flattenedResults.filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                pageRef.current = currentPage;
            } else {
                setData(flattenedResults as any);
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
    }, [currentUserId, pageSize, searchTerm, assignedUserId, isVendedor, userRole, subordinateIds, channelFilter, subclassificationFilter, nivelPremiumFilter, startDate, endDate, sortField, sortAsc]);

    // Initial Fetch & Filter Fetch
    useEffect(() => {
        fetchAccounts(false);
    }, [fetchAccounts]);

    // OPTIMISTIC UI
    useEffect(() => {
        const handleOptimisticUpdate = (e: any) => {
            const { entityType, entityId, updates } = e.detail;
            if (entityType === 'CRM_Cuentas') {
                setData(prev => {
                    const exists = prev.find(item => item.id === entityId);
                    if (exists) {
                        return prev.map(item => item.id === entityId ? { ...item, ...updates } : item);
                    }
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
        setChannelFilter,
        setSubclassificationFilter,
        setNivelPremiumFilter,
        setStartDate,
        setEndDate,
        setSortField,
        setSortAsc,
        sortField,
        sortAsc,
        refresh: () => fetchAccounts(false)
    };
}
