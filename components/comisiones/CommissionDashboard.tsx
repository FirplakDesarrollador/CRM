"use client";

import { useState } from 'react';
import { useCommissionDashboard, VendedorSummary } from '@/lib/hooks/useCommissionDashboard';
import { Loader2, TrendingUp, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { CommissionDetailsModal } from './CommissionDetailsModal'; // Assuming this path for the new component

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}


export function CommissionDashboard() {
    const { summary, vendedorBreakdown, loading, error, setDateFrom, setDateTo } = useCommissionDashboard();
    const [selectedVendor, setSelectedVendor] = useState<{ id: string; name: string } | null>(null);

    return (
        <div className="space-y-6">
            {/* Period Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-slate-600 hidden sm:block">Periodo:</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            onChange={e => setDateFrom(e.target.value || null)}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm w-full sm:w-auto"
                        />
                        <span className="text-sm text-slate-400">a</span>
                        <input
                            type="date"
                            onChange={e => setDateTo(e.target.value || null)}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm w-full sm:w-auto"
                        />
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-medium">Error: {error}</span>
                </div>
            )}

            {/* Summary Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <SummaryCard
                            icon={<TrendingUp className="w-5 h-5" />}
                            iconBg="bg-emerald-100 text-emerald-600"
                            label="Total Devengada"
                            value={formatCurrency(summary.total_devengada)}
                            valueColor="text-emerald-700"
                        />
                        <SummaryCard
                            icon={<CheckCircle2 className="w-5 h-5" />}
                            iconBg="bg-blue-100 text-blue-600"
                            label="Total Pagada"
                            value={formatCurrency(summary.total_pagada)}
                            valueColor="text-blue-700"
                        />
                        <SummaryCard
                            icon={<Clock className="w-5 h-5" />}
                            iconBg="bg-amber-100 text-amber-600"
                            label="Pendiente de Pago"
                            value={formatCurrency(summary.pendiente)}
                            valueColor="text-amber-700"
                        />
                        <SummaryCard
                            icon={<DollarSign className="w-5 h-5" />}
                            iconBg="bg-slate-100 text-slate-600"
                            label="Ajustes Netos"
                            value={formatCurrency(summary.total_ajustes + summary.total_reversos)}
                            valueColor={summary.total_ajustes + summary.total_reversos < 0 ? "text-red-600" : "text-slate-700"}
                        />
                        <SummaryCard
                            icon={<TrendingUp className="w-5 h-5" />}
                            iconBg="bg-purple-100 text-purple-600"
                            label="Potencial (Abiertas)"
                            value={formatCurrency(summary.potencial)}
                            valueColor="text-purple-700"
                        />
                    </div>

                    {/* Vendedor Breakdown */}
                    {vendedorBreakdown.length > 0 && (
                        <>
                            <div className="flex items-center justify-between pt-4">
                                <h3 className="font-bold text-slate-900 border-l-4 border-[#254153] pl-3">
                                    Desglose por Vendedor
                                </h3>
                                <div className="text-right">
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                        {vendedorBreakdown.length} vendedores
                                    </span>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Clic en un vendedor para ver detalle
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                                <table className="w-full min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/50">
                                            <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Vendedor</th>
                                            <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Devengada</th>
                                            <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Pagada</th>
                                            <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Pendiente</th>
                                            <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Potencial</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {vendedorBreakdown.map(v => (
                                            <tr
                                                key={v.vendedor_id}
                                                onClick={() => setSelectedVendor({ id: v.vendedor_id, name: v.vendedor_name })}
                                                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                            >
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 z-10 transition-colors">
                                                    {v.vendedor_name}
                                                    {v.open_opps_count > 0 && (
                                                        <span className="ml-2 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                            {v.open_opps_count} opps
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-emerald-700 text-right font-medium">{formatCurrency(v.devengada)}</td>
                                                <td className="px-4 py-3 text-sm text-blue-700 text-right font-medium">{formatCurrency(v.pagada)}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-right">
                                                    <span className={v.pendiente > 0 ? 'text-amber-700' : 'text-slate-500'}>{formatCurrency(v.pendiente)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-purple-700 text-right font-medium bg-purple-50/30">
                                                    {formatCurrency(v.potencial)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Modal */}
            {selectedVendor && (
                <CommissionDetailsModal
                    vendedorId={selectedVendor.id}
                    vendedorName={selectedVendor.name}
                    dateFrom={null}
                    dateTo={null}
                    onClose={() => setSelectedVendor(null)}
                />
            )}
        </div>
    );
}

function SummaryCard({ icon, iconBg, label, value, valueColor }: {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string;
    valueColor: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow min-w-0">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
                <span className="text-sm font-semibold text-slate-500 truncate" title={label}>{label}</span>
            </div>
            <p className={`text-xl font-bold ${valueColor} truncate`} title={value}>
                {value}
            </p>
        </div>
    );
}
