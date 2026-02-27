import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';
import { db } from '@/lib/db';

export type ActivityServer = {
    id: string;
    asunto: string;
    descripcion?: string;
    fecha_inicio: string;
    fecha_fin?: string;
    tipo_actividad: 'TAREA' | 'EVENTO';
    is_completed: boolean;
    opportunity_id?: string;
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    // Joined data
    opportunity?: { nombre: string } | null;
    user?: { full_name: string } | null;
};

type UseActivitiesServerProps = {
    pageSize?: number;
    opportunityId?: string;
};

export function useActivitiesServer({ pageSize = 20, opportunityId }: UseActivitiesServerProps = {}) {
    const [data, setData] = useState<ActivityServer[]>([]);
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<'all' | 'TAREA' | 'EVENTO'>('all');
    const [showCompleted, setShowCompleted] = useState<boolean>(true);

    // User Context
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        syncEngine.getCurrentUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user?.id);
        });
    }, []);

    const fetchActivities = useCallback(async (isLoadMore = false) => {
        if (!currentUserId) return; // Wait for user

        setLoading(true);
        try {
            // Calculate range
            const currentPage = isLoadMore ? page + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            if (!navigator.onLine) {
                console.log("[useActivitiesServer] Device is offline. Falling back to local Dexie database...");
                let localActivities = await db.activities.toArray();
                const allOpps = await db.opportunities.toArray();
                const oppMap = new Map(allOpps.map(o => [o.id, o]));

                if (opportunityId) {
                    localActivities = localActivities.filter(a => a.opportunity_id === opportunityId);
                } else {
                    localActivities = localActivities.filter(a => a.created_by === currentUserId || a.updated_by === currentUserId);
                }

                if (searchTerm) {
                    const lowerSearch = searchTerm.toLowerCase();
                    localActivities = localActivities.filter(a => a.asunto.toLowerCase().includes(lowerSearch));
                }

                if (typeFilter !== 'all') {
                    localActivities = localActivities.filter(a => a.tipo_actividad === typeFilter);
                }

                if (!showCompleted) {
                    localActivities = localActivities.filter(a => !a.is_completed);
                }

                localActivities.sort((a, b) => {
                    const dateA = new Date(a.fecha_inicio).getTime();
                    const dateB = new Date(b.fecha_inicio).getTime();
                    return dateB - dateA;
                });

                const totalCount = localActivities.length;
                const paginatedActivities = localActivities.slice(from, to + 1);

                const flattenedResults = paginatedActivities.map(item => {
                    const opp = item.opportunity_id ? oppMap.get(item.opportunity_id) : null;
                    return {
                        ...item,
                        opportunity: opp ? { nombre: opp.nombre } : null,
                        user: { full_name: 'Usuario Offline' }
                    };
                });

                if (isLoadMore) {
                    setData(prev => {
                        const existingIds = new Set(prev.map(i => i.id));
                        const newItems = flattenedResults.filter(i => !existingIds.has(i.id));
                        return [...prev, ...newItems] as any;
                    });
                    setPage(currentPage);
                } else {
                    setData(flattenedResults as any);
                    setPage(1);
                }
                setCount(totalCount);
                setHasMore(from + paginatedActivities.length < totalCount);
                return;
            }

            let query = supabase
                .from('CRM_Actividades')
                .select(`
                    id, 
                    asunto, 
                    descripcion,
                    fecha_inicio,
                    fecha_fin,
                    tipo_actividad,
                    is_completed,
                    opportunity_id,
                    user_id,
                    created_at,
                    updated_at,
                    opportunity:CRM_Oportunidades(nombre)
                `, { count: 'exact' })
                .eq('is_deleted', false);

            // Apply Filters
            if (opportunityId) {
                query = query.eq('opportunity_id', opportunityId);
            } else {
                // Only show user's activities unless filtering by opportunity
                query = query.eq('user_id', currentUserId);
            }

            if (searchTerm) {
                query = query.ilike('asunto', `%${searchTerm}%`);
            }

            if (typeFilter !== 'all') {
                query = query.eq('tipo_actividad', typeFilter);
            }

            if (!showCompleted) {
                query = query.eq('is_completed', false);
            }

            // Order by date (most recent first)
            query = query.order('fecha_inicio', { ascending: false });

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
            console.error("Error fetching activities:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, pageSize, searchTerm, typeFilter, showCompleted, opportunityId, page]);

    // Initial Fetch & Filter Fetch - Reset on filter change
    useEffect(() => {
        fetchActivities(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, typeFilter, showCompleted, opportunityId, currentUserId]);

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchActivities(true);
        }
    };

    return {
        data,
        count,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setTypeFilter,
        setShowCompleted,
        refresh: () => fetchActivities(false)
    };
}
