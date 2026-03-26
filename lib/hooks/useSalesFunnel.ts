import { useState, useCallback, useEffect } from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

export interface FunnelStage {
    fase_id: number;
    fase_nombre: string;
    orden: number;
    total_amount: number;
    count: number;
    color: string;
}

export interface SalesFunnelFilters {
    canal_id: string | null;
    advisor_id: string | null;
    subclasificacion_id: number | null;
    nivel_premium: 'ORO' | 'PLATA' | 'BRONCE' | null;
    search_query?: string | null;
}

export function useSalesFunnel(filters?: SalesFunnelFilters) {
    const { user, role, isLoading: userLoading } = useCurrentUser();
    const [data, setData] = useState<FunnelStage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [revision, setRevision] = useState(0);

    const mutate = useCallback(() => {
        setRevision(prev => prev + 1);
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            if (!user) {
                if (isMounted) {
                    setData([]);
                    setIsLoading(false);
                }
                return;
            }

            try {
                if (isMounted) setIsLoading(true);

                const { data: rpcData, error: rpcError } = await supabase.rpc('get_sales_funnel_data', {
                    p_user_id: user.id,
                    p_user_role: role || 'USER',
                    p_canal_id: filters?.canal_id || null,
                    p_advisor_id: filters?.advisor_id || null,
                    p_subclasificacion_id: filters?.subclasificacion_id || null,
                    p_nivel_premium: filters?.nivel_premium || null,
                    p_search_query: filters?.search_query || null
                });

                if (rpcError) throw rpcError;

                if (isMounted) {
                    setData(rpcData as FunnelStage[] || []);
                    setError(null);
                }
            } catch (err: any) {
                console.error("Error fetching sales funnel data from RPC:", err);
                if (isMounted) setError(err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [
        user?.id,
        role,
        filters?.canal_id,
        filters?.advisor_id,
        filters?.subclasificacion_id,
        filters?.nivel_premium,
        filters?.search_query,
        revision
    ]);

    return {
        data,
        isLoading: userLoading || isLoading,
        error,
        mutate
    };
}
