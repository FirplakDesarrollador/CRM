"use client";

import { useState } from 'react';
import { CommissionRule } from '@/lib/hooks/useCommissionRules';
import { Search, Loader2, ChevronDown, Power } from 'lucide-react';

type RuleTableProps = {
    data: CommissionRule[];
    loading: boolean;
    hasMore: boolean;
    count: number;
    onLoadMore: () => void;
    onEdit: (rule: CommissionRule) => void;
    onDeactivate: (id: string) => void;
    onCanalFilter: (canal: string | null) => void;
    onActiveFilter: (active: boolean | null) => void;
};

function calculatePriority(rule: CommissionRule): number {
    return (rule.vendedor_id ? 8 : 0) +
        ((rule.cuenta_id || (rule.cuentas_ids && rule.cuentas_ids.length > 0)) ? 4 : 0) +
        (rule.categoria_id ? 2 : 0) +
        (rule.canal_id ? 1 : 0);
}

function getPriorityBadge(score: number) {
    if (score >= 8) return { label: `P${score}`, className: 'bg-purple-100 text-purple-700' };
    if (score >= 4) return { label: `P${score}`, className: 'bg-blue-100 text-blue-700' };
    if (score >= 1) return { label: `P${score}`, className: 'bg-amber-100 text-amber-700' };
    return { label: 'P0', className: 'bg-slate-100 text-slate-500' };
}

export function CommissionRuleTable({
    data, loading, hasMore, count, onLoadMore, onEdit, onDeactivate, onCanalFilter, onActiveFilter
}: RuleTableProps) {
    const [showActiveOnly, setShowActiveOnly] = useState(true);

    const handleActiveToggle = () => {
        const next = showActiveOnly ? null : true;
        setShowActiveOnly(!showActiveOnly);
        onActiveFilter(next);
    };

    if (loading && data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <span className="text-sm text-slate-500">{count} regla{count !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleActiveToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${showActiveOnly ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                        <Power className="w-3 h-3" />
                        {showActiveOnly ? 'Solo activas' : 'Todas'}
                    </button>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">
                    No hay reglas registradas
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Prior.</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Vendedor</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Cliente</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Categoria</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Canal</th>
                                <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">%</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Vigencia</th>
                                <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Estado</th>
                                <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.map(rule => {
                                const priority = calculatePriority(rule);
                                const badge = getPriorityBadge(priority);
                                return (
                                    <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${badge.className}`}>{badge.label}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-48 truncate">{rule.nombre || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {rule.vendedor?.full_name || <span className="text-slate-400 italic">Todos</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {rule.cuenta?.nombre || (rule.cuentas_ids && rule.cuentas_ids.length > 0 ? (
                                                <span className="text-blue-600 font-medium">{rule.cuentas_ids.length} clientes</span>
                                            ) : <span className="text-slate-400 italic">Todos</span>)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {rule.categoria ? (
                                                <span className="font-mono text-xs">{rule.categoria.prefijo}</span>
                                            ) : <span className="text-slate-400 italic">Todas</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {rule.canal?.nombre || <span className="text-slate-400 italic">Todos</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{rule.porcentaje_comision}%</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {rule.vigencia_desde}
                                            {rule.vigencia_hasta ? ` → ${rule.vigencia_hasta}` : ' → ∞'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {rule.is_active ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button onClick={() => onEdit(rule)} className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                                    Editar
                                                </button>
                                                {rule.is_active && (
                                                    <button onClick={() => onDeactivate(rule.id)} className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                        Desactivar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Load More */}
            {hasMore && (
                <div className="px-4 py-3 border-t border-slate-100 text-center">
                    <button onClick={onLoadMore} disabled={loading} className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Cargar mas'}
                    </button>
                </div>
            )}
        </div>
    );
}
