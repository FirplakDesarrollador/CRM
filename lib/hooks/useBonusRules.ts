import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export type BonusRule = {
    id: string;
    nombre: string;
    vendedor_id: string | null;
    periodo: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
    meta_recaudo: number;
    monto_bono: number;
    currency_id: string;
    is_active: boolean;
    created_at: string;

    // Joined
    vendedor?: { full_name: string } | null;
};

export function useBonusRules() {
    const [rules, setRules] = useState<BonusRule[]>([]);
    const [loading, setLoading] = useState(true);
    const { role } = useCurrentUser();

    const fetchRules = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('CRM_ReglasBono')
                .select(`
                    *,
                    vendedor:vendedor_id(full_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map the joined data if needed, but supabase returns structured object usually
            // We just need to ensure the type matches
            setRules(data as unknown as BonusRule[]);
        } catch (err) {
            console.error('Error fetching bonus rules:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const createRule = async (rule: Omit<BonusRule, 'id' | 'created_at' | 'vendedor'>) => {
        const { data, error } = await supabase
            .from('CRM_ReglasBono')
            .insert([{
                nombre: rule.nombre,
                vendedor_id: rule.vendedor_id || null, // Ensure empty string becomes null
                periodo: rule.periodo,
                meta_recaudo: rule.meta_recaudo,
                monto_bono: rule.monto_bono,
                currency_id: rule.currency_id,
                is_active: rule.is_active
            }])
            .select()
            .single();

        if (error) throw error;
        await fetchRules();
        return data;
    };

    const updateRule = async (id: string, updates: Partial<BonusRule>) => {
        const { error } = await supabase
            .from('CRM_ReglasBono')
            .update({
                ...updates,
                vendedor_id: updates.vendedor_id || null
            })
            .eq('id', id);

        if (error) throw error;
        await fetchRules();
    };

    const deleteRule = async (id: string) => {
        const { error } = await supabase
            .from('CRM_ReglasBono')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchRules();
    };

    const toggleActive = async (id: string, currentState: boolean) => {
        await updateRule(id, { is_active: !currentState });
    };

    return {
        rules,
        loading,
        refresh: fetchRules,
        createRule,
        updateRule,
        deleteRule,
        toggleActive
    };
}
