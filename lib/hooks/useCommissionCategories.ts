import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type CommissionCategory = {
    id: number;
    prefijo: string;
    nombre: string;
    descripcion: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export function useCommissionCategories() {
    const [data, setData] = useState<CommissionCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const { data: result, error } = await supabase
                .from('CRM_ComisionCategorias')
                .select('*')
                .order('prefijo', { ascending: true });

            if (error) throw error;
            setData(result || []);
        } catch (err) {
            console.error('Error fetching commission categories:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const createCategory = async (category: { prefijo: string; nombre: string; descripcion?: string }) => {
        const { error } = await supabase
            .from('CRM_ComisionCategorias')
            .insert({
                prefijo: category.prefijo.substring(0, 6),
                nombre: category.nombre,
                descripcion: category.descripcion || null,
            });

        if (error) throw error;
        await fetchCategories();
    };

    const updateCategory = async (id: number, updates: Partial<Pick<CommissionCategory, 'nombre' | 'descripcion' | 'is_active'>>) => {
        const { error } = await supabase
            .from('CRM_ComisionCategorias')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        await fetchCategories();
    };

    const bulkUpload = async (categories: { prefijo: string; nombre: string; descripcion?: string }[]) => {
        const { data: result, error } = await supabase.rpc('admin_upsert_commission_categories', {
            p_categories: categories,
        });

        if (error) throw error;
        await fetchCategories();
        return result;
    };

    const autoDetectPrefixes = async () => {
        const { data: products, error } = await supabase
            .from('CRM_ListaDePrecios')
            .select('numero_articulo');

        if (error) throw error;
        if (!products) return [];

        const existingPrefixes = new Set(data.map(c => c.prefijo));
        const newPrefixes = new Set<string>();

        for (const p of products) {
            if (p.numero_articulo && p.numero_articulo.length >= 6) {
                const prefix = p.numero_articulo.substring(0, 6);
                if (!existingPrefixes.has(prefix)) {
                    newPrefixes.add(prefix);
                }
            }
        }

        return Array.from(newPrefixes).sort();
    };

    return {
        data,
        loading,
        refresh: fetchCategories,
        createCategory,
        updateCategory,
        bulkUpload,
        autoDetectPrefixes,
    };
}
