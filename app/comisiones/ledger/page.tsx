"use client";

import { useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/permissions';
import { useCommissionLedger, LedgerEntry } from '@/lib/hooks/useCommissionLedger';
import { CommissionLedgerTable } from '@/components/comisiones/CommissionLedgerTable';
import { CommissionAdjustmentModal } from '@/components/comisiones/CommissionAdjustmentModal';
import { BookOpen, CreditCard, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LedgerPage() {
    const { role } = useCurrentUser();
    const canViewAll = hasPermission(role, 'view_all_commissions');
    const canAdjust = hasPermission(role, 'create_commission_adjustment');

    const {
        data, count, loading, hasMore, loadMore, refresh,
        recordPagada, registerPayment, recordAdjustment, recordReversal,
        setTipoFilter, setVendedorFilter, setCanalFilter,
        setOportunidadFilter, setDateFrom, setDateTo,
    } = useCommissionLedger();

    // Adjustment modal
    const [adjustEntry, setAdjustEntry] = useState<LedgerEntry | null>(null);
    const [adjustMode, setAdjustMode] = useState<'AJUSTE' | 'REVERSO'>('AJUSTE');

    // Pagada form
    const [showPagadaForm, setShowPagadaForm] = useState(false);
    const [pagadaOppId, setPagadaOppId] = useState('');
    const [pagadaSapRef, setPagadaSapRef] = useState('');
    const [pagadaMonto, setPagadaMonto] = useState('');
    const [pagadaFecha, setPagadaFecha] = useState(new Date().toISOString().split('T')[0]);
    const [isPagadaSubmitting, setIsPagadaSubmitting] = useState(false);
    const [pagadaMessage, setPagadaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    if (!canViewAll) {
        return (
            <div className="max-w-7xl mx-auto p-6 text-center py-24">
                <p className="text-slate-500">No tienes permisos para acceder a esta pagina.</p>
            </div>
        );
    }

    const handleAdjust = (entry: LedgerEntry) => {
        setAdjustEntry(entry);
        setAdjustMode('AJUSTE');
    };

    const handleReverse = (entry: LedgerEntry) => {
        setAdjustEntry(entry);
        setAdjustMode('REVERSO');
    };

    const handleConfirmAdjustment = async (entradaId: string, monto: number, motivo: string) => {
        if (adjustMode === 'REVERSO') {
            await recordReversal(entradaId, motivo);
        } else {
            await recordAdjustment(entradaId, monto, motivo);
        }
    };

    const handlePagada = async () => {
        if (!pagadaOppId || !pagadaSapRef || !pagadaMonto) return;
        setIsPagadaSubmitting(true);
        setPagadaMessage(null);
        try {
            // New Flow: Register Payment (which triggers Bonus check + Legacy Paid logic)
            const result: any = await registerPayment(pagadaOppId, Number(pagadaMonto), pagadaSapRef, pagadaFecha);

            if (result?.success) {
                const bonusInfo = result.bonus_check?.bonuses_awarded > 0
                    ? ` y se generaron ${result.bonus_check.bonuses_awarded} BONOS`
                    : '';
                setPagadaMessage({ type: 'success', text: `Pago registrado correctamente${bonusInfo}.` });
                setPagadaOppId('');
                setPagadaSapRef('');
                setPagadaMonto('');
            } else {
                setPagadaMessage({ type: 'error', text: result?.error || 'Error desconocido' });
            }
        } catch (err: any) {
            setPagadaMessage({ type: 'error', text: err.message });
        } finally {
            setIsPagadaSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Ledger de Comisiones</h1>
                        <p className="text-sm text-slate-500">Registro inmutable de todos los movimientos de comisiones</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/comisiones" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        Volver
                    </Link>
                    {canAdjust && (
                        <button
                            onClick={() => setShowPagadaForm(!showPagadaForm)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all"
                        >
                            <CreditCard className="w-4 h-4" />
                            Registrar Pago SAP
                        </button>
                    )}
                </div>
            </div>

            {/* Pagada Form */}
            {showPagadaForm && (
                <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-bold text-slate-900">Registrar Pago Recibido (PAGADA)</h3>
                    <p className="text-sm text-slate-500">Registra que el pago de SAP fue recibido para una oportunidad. Esto crea entradas PAGADA espejo de las DEVENGADA existentes.</p>

                    {pagadaMessage && (
                        <div className={`p-3 rounded-xl text-sm font-medium ${pagadaMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {pagadaMessage.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">ID de Oportunidad *</label>
                            <input
                                type="text"
                                value={pagadaOppId}
                                onChange={e => setPagadaOppId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
                                placeholder="UUID de la oportunidad"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Referencia de Pago SAP *</label>
                            <input
                                type="text"
                                value={pagadaSapRef}
                                onChange={e => setPagadaSapRef(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
                                placeholder="Numero de documento SAP"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Monto Recaudado (COP) *</label>
                            <input
                                type="number"
                                value={pagadaMonto}
                                onChange={e => setPagadaMonto(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de Recaudo *</label>
                            <input
                                type="date"
                                value={pagadaFecha}
                                onChange={e => setPagadaFecha(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowPagadaForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                        <button
                            onClick={handlePagada}
                            disabled={isPagadaSubmitting || !pagadaOppId || !pagadaSapRef}
                            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isPagadaSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Pago'}
                        </button>
                    </div>
                </div>
            )}

            {/* Ledger Table */}
            <CommissionLedgerTable
                data={data}
                loading={loading}
                hasMore={hasMore}
                count={count}
                onLoadMore={loadMore}
                showActions={canAdjust}
                onAdjust={canAdjust ? handleAdjust : undefined}
                onReverse={canAdjust ? handleReverse : undefined}
                onTipoFilter={setTipoFilter}
                onVendedorFilter={setVendedorFilter}
                onCanalFilter={setCanalFilter}
                onDateFrom={setDateFrom}
                onDateTo={setDateTo}
            />

            {/* Adjustment Modal */}
            {adjustEntry && (
                <CommissionAdjustmentModal
                    entry={adjustEntry}
                    mode={adjustMode}
                    onConfirm={handleConfirmAdjustment}
                    onClose={() => setAdjustEntry(null)}
                />
            )}
        </div>
    );
}
