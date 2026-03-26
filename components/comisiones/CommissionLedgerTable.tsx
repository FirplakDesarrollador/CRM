"use client";

import { useState } from 'react';
import { LedgerEntry } from '@/lib/hooks/useCommissionLedger';
import { Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react';

type LedgerTableProps = {
    data: LedgerEntry[];
    loading: boolean;
    hasMore: boolean;
    count: number;
    onLoadMore: () => void;
    onAdjust?: (entry: LedgerEntry) => void;
    onReverse?: (entry: LedgerEntry) => void;
    showActions?: boolean;
    // Filters
    onTipoFilter: (tipo: string | null) => void;
    onVendedorFilter: (vendedorId: string | null) => void;
    onCanalFilter: (canalId: string | null) => void;
    onDateFrom: (date: string | null) => void;
    onDateTo: (date: string | null) => void;
};

const TIPO_BADGES: Record<string, { className: string; label: string }> = {
    DEVENGADA: { className: 'bg-emerald-100 text-emerald-700', label: 'Devengada' },
    PAGADA: { className: 'bg-blue-100 text-blue-700', label: 'Pagada' },
    AJUSTE: { className: 'bg-amber-100 text-amber-700', label: 'Ajuste' },
    REVERSO: { className: 'bg-red-100 text-red-700', label: 'Reverso' },
};

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency || 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CommissionLedgerTable({
    data, loading, hasMore, count, onLoadMore,
    onAdjust, onReverse, showActions = false,
    onTipoFilter, onVendedorFilter, onCanalFilter, onDateFrom, onDateTo,
}: LedgerTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [localTipo, setLocalTipo] = useState('');
    const [localDateFrom, setLocalDateFrom] = useState('');
    const [localDateTo, setLocalDateTo] = useState('');

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                <select
                    value={localTipo}
                    onChange={e => { setLocalTipo(e.target.value); onTipoFilter(e.target.value || null); }}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
                >
                    <option value="">Todos los tipos</option>
                    <option value="DEVENGADA">Devengada</option>
                    <option value="PAGADA">Pagada</option>
                    <option value="AJUSTE">Ajuste</option>
                    <option value="REVERSO">Reverso</option>
                </select>
                <input
                    type="date"
                    value={localDateFrom}
                    onChange={e => { setLocalDateFrom(e.target.value); onDateFrom(e.target.value || null); }}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    placeholder="Desde"
                />
                <input
                    type="date"
                    value={localDateTo}
                    onChange={e => { setLocalDateTo(e.target.value); onDateTo(e.target.value || null); }}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    placeholder="Hasta"
                />
                <span className="text-sm text-slate-500 ml-auto">{count} entrada{count !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading && data.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-12 text-sm text-slate-500">
                        No hay entradas en el ledger
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="w-8 px-2 py-3" />
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Fecha</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Tipo</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Oportunidad</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Vendedor</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Cliente</th>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Canal</th>
                                    <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Base</th>
                                    <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">%</th>
                                    <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Comision</th>
                                    {showActions && <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.map(entry => {
                                    const badge = TIPO_BADGES[entry.tipo_evento] || TIPO_BADGES.DEVENGADA;
                                    const isExpanded = expandedId === entry.id;
                                    return (
                                        <>
                                            <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-2 py-3">
                                                    <button
                                                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                                        className="text-slate-400 hover:text-slate-600"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.className}`}>{badge.label}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700 max-w-32 truncate">{entry.oportunidad?.nombre || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{entry.vendedor?.full_name || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{entry.cuenta?.nombre || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{entry.canal?.nombre || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">{formatCurrency(entry.base_amount, entry.currency_id)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700 text-right">{entry.porcentaje_comision}%</td>
                                                <td className={`px-4 py-3 text-sm font-bold text-right whitespace-nowrap ${entry.monto_comision < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                                    {formatCurrency(entry.monto_comision, entry.currency_id)}
                                                </td>
                                                {showActions && (
                                                    <td className="px-4 py-3 text-right">
                                                        {entry.tipo_evento === 'DEVENGADA' && (
                                                            <div className="flex items-center gap-1 justify-end">
                                                                {onAdjust && <button onClick={() => onAdjust(entry)} className="px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 rounded-lg transition-all">Ajustar</button>}
                                                                {onReverse && <button onClick={() => onReverse(entry)} className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-all">Reversar</button>}
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${entry.id}-detail`}>
                                                    <td colSpan={showActions ? 11 : 10} className="px-8 py-4 bg-slate-50/70">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                            <div>
                                                                <p className="font-bold text-slate-600 mb-1">Regla aplicada</p>
                                                                <pre className="bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto text-[10px] text-slate-600">
                                                                    {JSON.stringify(entry.regla_snapshot, null, 2)}
                                                                </pre>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {entry.categoria_snapshot && (
                                                                    <div>
                                                                        <p className="font-bold text-slate-600 mb-1">Categoria</p>
                                                                        <p className="text-slate-500">{(entry.categoria_snapshot as any).prefijo} - {(entry.categoria_snapshot as any).nombre}</p>
                                                                    </div>
                                                                )}
                                                                {entry.motivo && (
                                                                    <div>
                                                                        <p className="font-bold text-slate-600 mb-1">Motivo</p>
                                                                        <p className="text-slate-500">{entry.motivo}</p>
                                                                    </div>
                                                                )}
                                                                {entry.sap_payment_ref && (
                                                                    <div>
                                                                        <p className="font-bold text-slate-600 mb-1">Referencia SAP</p>
                                                                        <p className="text-slate-500 font-mono">{entry.sap_payment_ref}</p>
                                                                    </div>
                                                                )}
                                                                {entry.entrada_referencia_id && (
                                                                    <div>
                                                                        <p className="font-bold text-slate-600 mb-1">Entrada referencia</p>
                                                                        <p className="text-slate-500 font-mono text-[10px]">{entry.entrada_referencia_id}</p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-bold text-slate-600 mb-1">ID Entrada</p>
                                                                    <p className="text-slate-500 font-mono text-[10px]">{entry.id}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {hasMore && (
                    <div className="px-4 py-3 border-t border-slate-100 text-center">
                        <button onClick={onLoadMore} disabled={loading} className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Cargar mas'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
