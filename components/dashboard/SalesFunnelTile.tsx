"use client";

import { useState, useEffect } from "react";
import { useSalesFunnel, SalesFunnelFilters } from "@/lib/hooks/useSalesFunnel";
import { formatCurrency } from "@/lib/utils";
import { Loader2, TrendingUp, AlertCircle, ChevronRight, BarChart2, RefreshCw } from "lucide-react";
import ReactECharts from "echarts-for-react";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { syncEngine } from "@/lib/sync";

interface SalesFunnelTileProps {
    filters?: SalesFunnelFilters;
}

export function SalesFunnelTile({ filters }: SalesFunnelTileProps) {
    const { data, isLoading, error, mutate } = useSalesFunnel(filters);
    const [mounted, setMounted] = useState(false);
    const { lastSyncTime, isSyncing } = useSyncStore();
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Trigger a full sync and then revalidate the funnel data
        await syncEngine.triggerSync();
        await mutate();
        setIsRefreshing(false);
    };

    if (!mounted) return null;

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-[480px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#254153] animate-spin" />
                    <p className="text-sm text-slate-400 font-medium">Actualizando datos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-[480px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-red-500">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold">Error al cargar datos</p>
                    <p className="text-xs text-red-400 max-w-[240px] text-center">{error}</p>
                    <button
                        onClick={() => mutate()}
                        className="text-xs font-bold text-slate-600 hover:text-slate-800 underline mt-2"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-[480px] flex items-center justify-center relative">
                <button
                    onClick={handleRefresh}
                    disabled={isSyncing || isRefreshing}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${isSyncing || isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-sm font-medium">No hay datos para estos filtros</p>
                    <p className="text-xs text-slate-300">Intenta sincronizar nuevamente</p>
                </div>
            </div>
        );
    }

    const totalPipeline = data.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
    const totalCount = data.reduce((acc, curr) => acc + Number(curr.count), 0);

    // Grouping by Order to merge stages (like Proposal and Negotiation if they share order)
    const groupedData = data.reduce((acc, curr) => {
        const existing = acc.find(item => item.orden === curr.orden);
        if (existing) {
            existing.total_amount = Number(existing.total_amount) + Number(curr.total_amount);
            existing.count = Number(existing.count) + Number(curr.count);
            if (!existing.fase_nombre.includes(curr.fase_nombre)) {
                existing.fase_nombre += ` / ${curr.fase_nombre}`;
            }
            return acc;
        }
        return [...acc, { ...curr, total_amount: Number(curr.total_amount), count: Number(curr.count) }];
    }, [] as typeof data).sort((a, b) => a.orden - b.orden);

    const maxAmount = Math.max(...groupedData.map(d => d.total_amount));
    const logMax = Math.log10(maxAmount + 1);

    // ECharts Funnel Option
    const option = {
        textStyle: {
            fontFamily: 'var(--font-geist-sans), sans-serif'
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: '#254153',
            borderWidth: 0,
            padding: 12,
            textStyle: { color: '#fff', fontSize: 12, fontWeight: 'bold', fontFamily: 'var(--font-geist-sans), sans-serif' },
            formatter: (params: any) => {
                const { name, value, data } = params;
                const actualValue = data.actualValue;
                const pct = totalPipeline > 0 ? ((actualValue / totalPipeline) * 100).toFixed(1) : "0";
                return `
                    <div style="font-family: var(--font-geist-sans), sans-serif;">
                        <div style="text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; opacity: 0.7; margin-bottom: 4px;">${name}</div>
                        <div style="font-size: 14px;">${formatCurrency(actualValue)}</div>
                        <div style="font-size: 10px; margin-top: 4px; opacity: 0.8;">${data.count} Opportunities • ${pct}% Share</div>
                    </div>
                `;
            }
        },
        series: [
            {
                name: 'Funnel',
                type: 'funnel',
                left: '10%',
                top: 40,
                bottom: 20,
                width: '70%',
                min: 0,
                max: logMax || 1,
                minSize: '2%', // Significant reduction to allow visibility of smaller stages without clamping
                maxSize: '100%',
                sort: 'none', // Preservation of stage order
                gap: 4,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params: any) => {
                        return `{name|${params.name}}\n{val|${formatCurrency(params.data.actualValue)}}`;
                    },
                    rich: {
                        name: {
                            fontSize: 10,
                            fontWeight: 900,
                            color: '#94a3b8',
                            padding: [0, 0, 4, 0],
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-geist-sans), sans-serif'
                        },
                        val: {
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: '#1e293b',
                            fontFamily: 'var(--font-geist-sans), sans-serif'
                        }
                    }
                },
                labelLine: {
                    length: 20,
                    lineStyle: {
                        width: 1,
                        type: 'solid'
                    }
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 2,
                    borderRadius: 8,
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.05)',
                    opacity: 0.9
                },
                emphasis: {
                    itemStyle: {
                        opacity: 1,
                        shadowBlur: 20,
                        shadowColor: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                data: groupedData.map(item => ({
                    // Using log scale for the 'value' which determines the width
                    // this allows stages with $1M to still be visible alongside stages with $100B
                    value: Math.log10(item.total_amount + 1),
                    actualValue: item.total_amount,
                    name: item.fase_nombre,
                    itemStyle: {
                        color: item.total_amount === 0 ? '#e2e8f0' : item.color,
                        opacity: item.total_amount === 0 ? 0.4 : 0.9
                    },
                    count: item.count
                }))
            }
        ]
    };

    return (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 h-full flex flex-col transition-all duration-300 relative group">
            {/* Sync Control (Top Right) */}
            <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {lastSyncTime && (
                    <span className="text-[10px] text-slate-400 font-medium">
                        Actualizado: {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
                <button
                    onClick={handleRefresh}
                    disabled={isSyncing || isRefreshing}
                    className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-[#254153] transition-colors"
                    title="Forzar sincronización de datos"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing || isRefreshing ? 'animate-spin text-[#254153]' : ''}`} />
                </button>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#254153] flex items-center justify-center shadow-lg shadow-[#254153]/20">
                        <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-xl tracking-tight">Embudo de Ventas</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-xs text-slate-400 font-medium lowercase">Pipeline Activo en Tiempo Real</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end mr-8"> {/* mr-8 to avoid overlapping with sync button */}
                    <p className="text-3xl font-black text-[#254153] tracking-tighter tabular-nums">
                        {formatCurrency(totalPipeline)}
                    </p>
                    <div className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100 flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Oportunidades:</span>
                        <span className="text-[11px] font-bold text-slate-600">{totalCount}</span>
                    </div>
                </div>
            </div>

            {/* Funnel Display with Apache ECharts */}
            <div className="flex-1 min-h-[400px]">
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                    notMerge={true}
                />
            </div>
        </div>
    );
}
