import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncEngine } from '@/lib/sync';

export type LedgerEntry = {
    id: string;
    tipo_evento: 'DEVENGADA' | 'PAGADA' | 'AJUSTE' | 'REVERSO';
    oportunidad_id: string;
    cotizacion_id: string | null;
    vendedor_id: string;
    cuenta_id: string;
    canal_id: string;
    base_amount: number;
    currency_id: string;
    porcentaje_comision: number;
    monto_comision: number;
    regla_id: string | null;
    regla_snapshot: Record<string, unknown>;
    categoria_id: number | null;
    categoria_snapshot: Record<string, unknown> | null;
    entrada_referencia_id: string | null;
    motivo: string | null;
    sap_payment_ref: string | null;
    created_by: string | null;
    created_at: string;
    // Joined data
    vendedor?: { full_name: string } | null;
    cuenta?: { nombre: string } | null;
    oportunidad?: { nombre: string } | null;
    canal?: { nombre: string } | null;
};

type UseLedgerProps = {
    pageSize?: number;
};

export function useCommissionLedger({ pageSize = 25 }: UseLedgerProps = {}) {
    const [data, setData] = useState<LedgerEntry[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [tipoFilter, setTipoFilter] = useState<string | null>(null);
    const [vendedorFilter, setVendedorFilter] = useState<string | null>(null);
    const [canalFilter, setCanalFilter] = useState<string | null>(null);
    const [oportunidadFilter, setOportunidadFilter] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState<string | null>(null);
    const [dateTo, setDateTo] = useState<string | null>(null);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        syncEngine.getCurrentUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id);
        });
    }, []);

    const fetchLedger = useCallback(async (isLoadMore = false) => {
        if (!currentUserId) return;

        setLoading(true);
        try {
            const currentPage = isLoadMore ? page + 1 : 1;
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('CRM_ComisionLedger')
                .select(`
                    *,
                    vendedor:CRM_Usuarios!CRM_ComisionLedger_vendedor_id_fkey(full_name),
                    cuenta:CRM_Cuentas!CRM_ComisionLedger_cuenta_id_fkey(nombre),
                    oportunidad:CRM_Oportunidades!CRM_ComisionLedger_oportunidad_id_fkey(nombre),
                    canal:CRM_Canales!CRM_ComisionLedger_canal_id_fkey(nombre)
                `, { count: 'exact' });

            if (tipoFilter) query = query.eq('tipo_evento', tipoFilter);
            if (vendedorFilter) query = query.eq('vendedor_id', vendedorFilter);
            if (canalFilter) query = query.eq('canal_id', canalFilter);
            if (oportunidadFilter) query = query.eq('oportunidad_id', oportunidadFilter);
            if (dateFrom) query = query.gte('created_at', dateFrom);
            if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59Z');

            query = query.order('created_at', { ascending: false }).range(from, to);

            const { data: result, error, count: totalCount } = await query;

            if (error) throw error;

            if (isLoadMore) {
                setData(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = (result as LedgerEntry[]).filter(i => !existingIds.has(i.id));
                    return [...prev, ...newItems];
                });
                setPage(currentPage);
            } else {
                setData(result as LedgerEntry[]);
                setPage(1);
            }

            if (totalCount !== null) {
                setCount(totalCount);
                setHasMore(from + (result?.length || 0) < totalCount);
            }
        } catch (err) {
            console.error('Error fetching commission ledger:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, pageSize, page, tipoFilter, vendedorFilter, canalFilter, oportunidadFilter, dateFrom, dateTo]);

    useEffect(() => {
        fetchLedger(false);
    }, [currentUserId, tipoFilter, vendedorFilter, canalFilter, oportunidadFilter, dateFrom, dateTo]);

    const recordPagada = async (oportunidadId: string, sapPaymentRef: string) => {
        const { data: result, error } = await supabase.rpc('record_commission_pagada', {
            p_oportunidad_id: oportunidadId,
            p_sap_payment_ref: sapPaymentRef,
            p_recorded_by: currentUserId,
        });

        if (error) throw error;
        await fetchLedger(false);
        return result;
        return result;
    };

    const registerPayment = async (oportunidadId: string, monto: number, sapDocEntry: string, fechaPago: string) => {
        const { data: result, error } = await supabase.rpc('register_payment', {
            p_oportunidad_id: oportunidadId,
            p_monto: monto,
            p_sap_doc_entry: sapDocEntry,
            p_fecha_pago: fechaPago
        });

        if (error) throw error;
        await fetchLedger(false);
        return result;
    };

    const recordAdjustment = async (entradaReferenciaId: string, montoAjuste: number, motivo: string) => {
        const { data: result, error } = await supabase.rpc('record_commission_adjustment', {
            p_entrada_referencia_id: entradaReferenciaId,
            p_monto_ajuste: montoAjuste,
            p_motivo: motivo,
            p_adjusted_by: currentUserId,
        });

        if (error) throw error;
        await fetchLedger(false);
        return result;
    };

    const recordReversal = async (entradaReferenciaId: string, motivo: string) => {
        const { data: result, error } = await supabase.rpc('record_commission_reversal', {
            p_entrada_referencia_id: entradaReferenciaId,
            p_motivo: motivo,
            p_reversed_by: currentUserId,
        });

        if (error) throw error;
        await fetchLedger(false);
        return result;
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchLedger(true);
        }
    };

    return {
        data,
        count,
        loading,
        hasMore,
        loadMore,
        refresh: () => fetchLedger(false),
        recordPagada,
        registerPayment,
        recordAdjustment,
        recordReversal,
        setTipoFilter,
        setVendedorFilter,
        setCanalFilter,
        setOportunidadFilter,
        setDateFrom,
        setDateTo,
    };
}
