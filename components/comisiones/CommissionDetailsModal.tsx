import { useState } from 'react';
import { X, Calendar, DollarSign, TrendingUp, History } from 'lucide-react';
import { useVendorCommissions } from '@/lib/hooks/useVendorCommissions';
// function formatCurrency is defined below

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

import { Loader2 } from 'lucide-react';

type CommissionDetailsModalProps = {
    vendedorId: string;
    vendedorName: string;
    dateFrom: string | null;
    dateTo: string | null;
    onClose: () => void;
};

export function CommissionDetailsModal({ vendedorId, vendedorName, dateFrom, dateTo, onClose }: CommissionDetailsModalProps) {
    const { historical, potential, loading, error } = useVendorCommissions(vendedorId, dateFrom, dateTo);
    const [activeTab, setActiveTab] = useState<'historical' | 'potential'>('historical');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Detalle de Comisiones</h2>
                        <p className="text-sm text-slate-500 font-medium">{vendedorName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-6 gap-6">
                    <button
                        onClick={() => setActiveTab('historical')}
                        className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'historical'
                            ? 'border-slate-800 text-slate-800'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <History className="w-4 h-4" />
                        Histórico (Ledger)
                    </button>
                    <button
                        onClick={() => setActiveTab('potential')}
                        className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'potential'
                            ? 'border-purple-600 text-purple-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        Proyección (Potencial)
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                            <p className="text-sm text-slate-400">Cargando datos...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
                            Error: {error}
                        </div>
                    ) : (
                        <>
                            {activeTab === 'historical' && (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Fecha</th>
                                                    <th className="px-4 py-3 text-left">Evento</th>
                                                    <th className="px-4 py-3 text-left">Oportunidad / Cuenta</th>
                                                    <th className="px-4 py-3 text-right">Base</th>
                                                    <th className="px-4 py-3 text-center">%</th>
                                                    <th className="px-4 py-3 text-right">Comisión</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {historical.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                                            No hay registros históricos en este periodo.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    historical.map(item => (
                                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 text-slate-600">
                                                                {new Date(item.created_at).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${item.tipo_evento === 'DEVENGADA' ? 'bg-emerald-100 text-emerald-700' :
                                                                    item.tipo_evento === 'PAGADA' ? 'bg-blue-100 text-blue-700' :
                                                                        item.tipo_evento === 'REVERSO' ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-slate-100 text-slate-700'
                                                                    }`}>
                                                                    {item.tipo_evento}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-slate-800">
                                                                    {item.oportunidad?.nombre || 'N/A'}
                                                                </div>
                                                                {item.concepto && (
                                                                    <div className="text-xs text-slate-400 mt-0.5">{item.concepto}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-600 font-mono">
                                                                {formatCurrency(item.base_amount)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-slate-600 font-mono bg-slate-50">
                                                                {item.porcentaje_comision}%
                                                            </td>
                                                            <td className={`px-4 py-3 text-right font-bold font-mono ${item.tipo_evento === 'REVERSO' ? 'text-red-600' : 'text-slate-800'
                                                                }`}>
                                                                {formatCurrency(item.monto_comision)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'potential' && (
                                <div className="space-y-4">
                                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-purple-800 text-sm mb-4 flex items-start gap-2">
                                        <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                                        <p>
                                            Estas son oportunidades <strong>Abiertas</strong>. Los valores son estimados según las reglas vigentes
                                            (se aplica la comisión más baja encontrada).
                                            El cálculo final se realizará al momento de cerrar la oportunidad.
                                        </p>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Cuenta / Cliente</th>
                                                    <th className="px-4 py-3 text-left">Regla Aplicada</th>
                                                    <th className="px-4 py-3 text-right">Valor Oportunidad</th>
                                                    <th className="px-4 py-3 text-center">% Est.</th>
                                                    <th className="px-4 py-3 text-right">Comisión Est.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {potential.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                                            No hay oportunidades abiertas para este vendedor.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    potential.map(item => (
                                                        <tr key={item.opportunity_id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                                {item.account_name}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-500 text-xs">
                                                                <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">
                                                                    {item.rule_name}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-600 font-mono">
                                                                {formatCurrency(item.amount)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-purple-700 font-bold bg-purple-50/30 font-mono">
                                                                {Number(item.pct_applied).toFixed(2)}%
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-purple-700 font-mono">
                                                                {formatCurrency(item.estimated_commission)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
