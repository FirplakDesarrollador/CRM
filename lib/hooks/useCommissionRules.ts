import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export type CommissionRule = {
    id: string;
    nombre: string | null;
    vendedor_id: string | null;
    cuenta_id: string | null;
    cuentas_ids: string[] | null;
    categoria_id: number | null;
    canal_id: string | null;
    porcentaje_comision: number;
    vigencia_desde: string;
    vigencia_hasta: string | null;
    is_active: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    // Joined data
    vendedor?: { full_name: string } | null;
    cuenta?: { nombre: string; nit: string } | null;
    categoria?: { prefijo: string; nombre: string } | null;
    canal?: { nombre: string } | null;
};

type UseCommissionRulesProps = {
    pageSize?: number;
};

export function useCommissionRules({ pageSize = 20 }: UseCommissionRulesProps = {}) {
    const { user } = useCurrentUser();
    const currentUserId = user?.id || null;

    const [data, setData] = useState<CommissionRule[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [canalFilter, setCanalFilter] = useState<string | null>(null);
    const [vendedorFilter, setVendedorFilter] = useState<string | null>(null);
    const [categoriaFilter, setCategoriaFilter] = useState<number | null>(null);
    const [activeFilter, setActiveFilter] = useState<boolean | null>(true);

    const fetchRules = useCallback(async (isLoadMore = false) => {
        if (!currentUserId) return;

        setLoading(true);
        try {
            const currentPage = isLoadMore ? page + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('CRM_ComisionReglas')
                .select(`
                    *,
                    vendedor:CRM_Usuarios!CRM_ComisionReglas_vendedor_id_fkey(full_name),
                    cuenta:CRM_Cuentas!CRM_ComisionReglas_cuenta_id_fkey(nombre, nit),
                    categoria:CRM_ComisionCategorias!CRM_ComisionReglas_categoria_id_fkey(prefijo, nombre),
                    canal:CRM_Canales!CRM_ComisionReglas_canal_id_fkey(nombre)
                `, { count: 'exact' });

            if (canalFilter) query = query.eq('canal_id', canalFilter);
            if (vendedorFilter) query = query.eq('vendedor_id', vendedorFilter);
            if (categoriaFilter) query = query.eq('categoria_id', categoriaFilter);
            if (activeFilter !== null) query = query.eq('is_active', activeFilter);

            query = query.order('created_at', { ascending: false }).range(from, to);

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = (result as CommissionRule[]).filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                setPage(currentPage);
            } else {
                setData(result as CommissionRule[]);
                setPage(Page => 1);
            }

            if (totalCount !== null) {
                setCount(totalCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            }
        } catch (err) {
            console.error('Error fetching commission rules:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, pageSize, page, canalFilter, vendedorFilter, categoriaFilter, activeFilter]);

    useEffect(() => {
        fetchRules(false);
    }, [currentUserId, canalFilter, vendedorFilter, categoriaFilter, activeFilter]);

    const createRule = async (rule: {
        nombre: string;
        vendedor_id?: string | null;
        cuenta_id?: string | null;
        cuentas_ids?: string[] | null;
        categoria_id?: number | null;
        canal_id?: string | null;
        porcentaje_comision: number;
        vigencia_desde: string;
        vigencia_hasta?: string | null;
    }) => {
        const { error } = await supabase
            .from('CRM_ComisionReglas')
            .insert({
                nombre: rule.nombre,
                vendedor_id: rule.vendedor_id || null,
                cuenta_id: rule.cuenta_id || null,
                cuentas_ids: rule.cuentas_ids || null,
                categoria_id: rule.categoria_id || null,
                canal_id: rule.canal_id || null,
                porcentaje_comision: rule.porcentaje_comision,
                vigencia_desde: rule.vigencia_desde,
                vigencia_hasta: rule.vigencia_hasta || null,
                created_by: currentUserId,
                updated_by: currentUserId,
            });

        if (error) throw error;
        await fetchRules(false);
    };

    const updateRule = async (id: string, updates: Partial<{
        nombre: string;
        vendedor_id: string | null;
        cuenta_id: string | null;
        cuentas_ids: string[] | null;
        categoria_id: number | null;
        canal_id: string | null;
        porcentaje_comision: number;
        vigencia_desde: string;
        vigencia_hasta: string | null;
        is_active: boolean;
    }>) => {
        const { error } = await supabase
            .from('CRM_ComisionReglas')
            .update({ ...updates, updated_by: currentUserId, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        await fetchRules(false);
    };

    const deactivateRule = async (id: string) => {
        await updateRule(id, { is_active: false });
    };

    const bulkUploadRules = async (rules: Record<string, unknown>[]) => {
        const { data: result, error } = await supabase.rpc('admin_upsert_commission_rules', {
            p_rules: rules,
        });

        if (error) throw error;
        await fetchRules(false);
        return result;
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchRules(true);
        }
    };

    return {
        data,
        count,
        loading,
        hasMore,
        loadMore,
        refresh: () => fetchRules(false),
        createRule,
        updateRule,
        deactivateRule,
        bulkUploadRules,
        setCanalFilter,
        setVendedorFilter,
        setCategoriaFilter,
        setActiveFilter,
    };
}
