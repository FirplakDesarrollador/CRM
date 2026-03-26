import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export interface FilterOptions {
    channels: { id: string, nombre: string }[];
    advisors: { id: string, full_name: string }[];
    clientTypes: { id: number, nombre: string }[];
}

export function useDashboardFilters() {
    const { user, role } = useCurrentUser();
    const [options, setOptions] = useState<FilterOptions>({
        channels: [],
        advisors: [],
        clientTypes: []
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchOptions() {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);

                // 1. Fetch Channels
                const { data: channels } = await supabase
                    .from('CRM_Canales')
                    .select('id, nombre')
                    .order('nombre');

                // 2. Fetch Advisors
                // If admin, fetch all. If coordinator, fetch subordinates. If seller, fetch none (or just self).
                let advisorsQuery = supabase.from('CRM_Usuarios').select('id, full_name');
                if (role === 'VENDEDOR') {
                    advisorsQuery = advisorsQuery.eq('id', user.id);
                } else if (role === 'COORDINADOR') {
                    // Coordinator sees themselves AND their subordinates
                    advisorsQuery = advisorsQuery.or(`id.eq.${user.id},coordinadores.cs.{${user.id}}`);
                }
                const { data: advisors } = await advisorsQuery.order('full_name');

                // 3. Fetch Client Types (Subclassifications)
                const { data: clientTypes } = await supabase
                    .from('CRM_Subclasificacion')
                    .select('id, nombre')
                    .order('nombre');

                setOptions({
                    channels: channels || [],
                    advisors: advisors || [],
                    clientTypes: clientTypes || []
                });
            } catch (error) {
                console.error('Error fetching filter options:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchOptions();
    }, [user?.id, role]);

    return { options, isLoading };
}
