import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useConfig() {
    const [config, setConfig] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const fetchConfig = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('CRM_Configuracion')
                .select('*');

            if (error) {
                // If the table doesn't exist yet, just log and fail gracefully
                console.warn('Config table not found or inaccessible. Please apply migrations.', error.message);
                setIsLoading(false);
                return;
            }

            const configMap: Record<string, any> = {};
            data?.forEach(item => {
                configMap[item.key] = item.value;
            });
            setConfig(configMap);

        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.app_metadata?.role === 'admin' || user?.id === '5f203417-b89b-4ac8-a95e-8b3823e5ca7b') {
            setIsAdmin(true);
        }
    };

    useEffect(() => {
        fetchConfig();
        checkAdmin();
    }, []);

    const updateConfig = async (key: string, value: any) => {
        try {
            const { error } = await supabase
                .from('CRM_Configuracion')
                .upsert({
                    key,
                    value,
                    description: key === 'min_premium_order_value' ? 'Valor mínimo de pedido para clientes premium' : undefined
                });

            if (error) throw error;

            await fetchConfig(); // Reload
            return true;
        } catch (e) {
            console.error('Error updating config:', e);
            alert('Error al actualizar configuración. Verifica permisos de administrador.');
            return false;
        }
    };

    return {
        config,
        isLoading,
        isAdmin,
        updateConfig,
        refresh: fetchConfig
    };
}
