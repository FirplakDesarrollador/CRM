"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Users2, Trophy, LineChart, BarChart3 } from "lucide-react";
import { useCanalPropioVendedores, TipoCanalVendedor } from "@/lib/hooks/useCanalPropioVendedores";
import { useCanalPropioOpportunities } from "@/lib/hooks/useCanalPropioOpportunities";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { getWeekKey } from "./weekUtils";
import { EstadoBucket, getEstadoBucket } from "./estadoUtils";
import { EChartsCallbackParams } from "./echartsTypes";
import { isPlausibleYear } from "./dateUtils";

const TIPO_CANAL_OPTIONS: { value: TipoCanalVendedor; label: string }[] = [
    { value: "Fisico", label: "Físico" },
    { value: "Online", label: "Online" },
];

// "Leads" reuses the same open/won/lost bucketing as the rest of indicadores,
// just with the labels this specific report uses in the source BI.
const LEAD_BUCKET_LABELS: Record<EstadoBucket, string> = {
    open: "En prospección",
    won: "Ganada",
    lost: "Perdida",
};
const LEAD_BUCKET_COLORS: Record<EstadoBucket, string> = {
    open: "#3b82f6",
    won: "#22c55e",
    lost: "#ef4444",
};
const LEAD_BUCKET_ORDER: EstadoBucket[] = ["open", "lost", "won"];

interface Filters {
    tiposCanal: TipoCanalVendedor[];
    year: string;
    estado: EstadoBucket | null; // set via chart click cross-filter
}

const EMPTY_FILTERS: Filters = { tiposCanal: [], year: "", estado: null };

export function Page5Leads() {
    const { tipoByVendedor, vendedorIds } = useCanalPropioVendedores();
    // Live from Supabase, same rationale as pages 3-4.
    const { opportunities } = useCanalPropioOpportunities(vendedorIds);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const scopedAdvisorIds = useMemo(() => {
        const tipoSet = filters.tiposCanal.length > 0 ? new Set(filters.tiposCanal) : null;
        return new Set(
            vendedorIds.filter(id => {
                if (!tipoSet) return true;
                const tipo = tipoByVendedor.get(id);
                return tipo ? tipoSet.has(tipo) : false;
            })
        );
    }, [vendedorIds, tipoByVendedor, filters.tiposCanal]);

    const yearOptions: SearchableSelectOption[] = useMemo(() => {
        const years = new Set<number>();
        (opportunities || []).forEach(o => {
            if (!o.created_at) return;
            const year = new Date(o.created_at).getFullYear();
            if (isPlausibleYear(year)) years.add(year);
        });
        years.add(new Date().getFullYear());
        return Array.from(years)
            .sort((a, b) => b - a)
            .map(y => ({ value: String(y), label: String(y) }));
    }, [opportunities]);

    // "Leads ingresados" = every opportunity entered into the Canal Propio
    // pipeline, regardless of estado — "ingresado" refers to when it was
    // created, so Fecha/weekly grouping use created_at (not fecha_cierre_estimada,
    // which is often still empty while a lead is open).
    const leadsWithoutEstado = useMemo(() => {
        const yearNum = filters.year ? Number(filters.year) : null;
        return (opportunities || []).filter(o => {
            if (o.is_deleted) return false;
            if (!o.owner_user_id || !scopedAdvisorIds.has(o.owner_user_id)) return false;
            if (yearNum != null) {
                if (!o.created_at) return false;
                if (new Date(o.created_at).getFullYear() !== yearNum) return false;
            }
            return true;
        });
    }, [opportunities, scopedAdvisorIds, filters.year]);

    const leads = useMemo(() => {
        if (!filters.estado) return leadsWithoutEstado;
        return leadsWithoutEstado.filter(o => getEstadoBucket(o.estado_id) === filters.estado);
    }, [leadsWithoutEstado, filters.estado]);

    const ganados = useMemo(() => leadsWithoutEstado.filter(o => getEstadoBucket(o.estado_id) === "won"), [leadsWithoutEstado]);

    const toggleEstadoFilter = (bucket: EstadoBucket) => {
        setFilters(prev => ({ ...prev, estado: prev.estado === bucket ? null : bucket }));
    };

    // --- Line chart: leads ingresados por semana ------------------------------
    const weeklyOption = useMemo(() => {
        const byWeek = new Map<string, number>();
        const weekLabel = new Map<string, number>();
        leads.forEach(o => {
            if (!o.created_at) return;
            const { key, week } = getWeekKey(new Date(o.created_at));
            weekLabel.set(key, week);
            byWeek.set(key, (byWeek.get(key) || 0) + 1);
        });
        const weekKeys = Array.from(byWeek.keys()).sort();
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: { trigger: "axis", backgroundColor: "#254153", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
            grid: { left: 40, right: 16, top: 16, bottom: 40 },
            xAxis: {
                type: "category",
                name: "Semana",
                nameLocation: "middle",
                nameGap: 26,
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                data: weekKeys.map(k => String(weekLabel.get(k))),
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            yAxis: {
                type: "value",
                name: "Leads Ingresados",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Leads Ingresados",
                    type: "line",
                    smooth: true,
                    showSymbol: false,
                    areaStyle: { opacity: 0.15 },
                    lineStyle: { width: 2, color: "#3b82f6" },
                    itemStyle: { color: "#3b82f6" },
                    data: weekKeys.map(k => byWeek.get(k) || 0),
                },
            ],
        };
    }, [leads]);

    // --- Horizontal bar chart: leads ingresados por estado --------------------
    const byEstadoOption = useMemo(() => {
        const counts: Record<EstadoBucket, number> = { open: 0, won: 0, lost: 0 };
        leadsWithoutEstado.forEach(o => {
            counts[getEstadoBucket(o.estado_id)] += 1;
        });
        const hasSelection = !!filters.estado;
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#254153", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
            grid: { left: 110, right: 24, top: 16, bottom: 16 },
            xAxis: {
                type: "value",
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            yAxis: {
                type: "category",
                data: LEAD_BUCKET_ORDER.map(b => LEAD_BUCKET_LABELS[b]),
                axisLabel: { fontSize: 11, color: "#475569", fontWeight: 600 },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            series: [
                {
                    name: "Leads Ingresados",
                    type: "bar",
                    barMaxWidth: 28,
                    cursor: "pointer",
                    itemStyle: { borderRadius: [0, 4, 4, 0] },
                    data: LEAD_BUCKET_ORDER.map(b => ({
                        value: counts[b],
                        bucket: b,
                        itemStyle: {
                            color: LEAD_BUCKET_COLORS[b],
                            opacity: hasSelection && filters.estado !== b ? 0.3 : 1,
                        },
                    })),
                },
            ],
        };
    }, [leadsWithoutEstado, filters.estado]);

    const handleEstadoBarClick = (params: EChartsCallbackParams) => {
        const bucket = params?.data?.bucket as EstadoBucket | undefined;
        if (bucket) toggleEstadoFilter(bucket);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tipo Canal</label>
                        <div className="flex items-center gap-4 h-[42px]">
                            {TIPO_CANAL_OPTIONS.map(opt => (
                                <label key={opt.value} className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-[#254153] focus:ring-[#254153]"
                                        checked={filters.tiposCanal.includes(opt.value)}
                                        onChange={() =>
                                            setFilters(prev => ({
                                                ...prev,
                                                tiposCanal: prev.tiposCanal.includes(opt.value)
                                                    ? prev.tiposCanal.filter(t => t !== opt.value)
                                                    : [...prev.tiposCanal, opt.value],
                                            }))
                                        }
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha</label>
                        <SearchableSelect options={yearOptions} value={filters.year} onChange={v => setFilters(prev => ({ ...prev, year: v }))} placeholder="Todas" />
                    </div>
                </div>
                {(filters.tiposCanal.length > 0 || filters.year || filters.estado) && (
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-3 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline">
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#254153] flex items-center justify-center text-white shrink-0">
                        <Users2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{leadsWithoutEstado.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leads Ingresados</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{ganados.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ganados</p>
                    </div>
                </div>
            </div>

            {/* Line chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <LineChart className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Leads Ingresados por Semana</h3>
                </div>
                <div className="min-h-[280px]">
                    {leads.length === 0 ? (
                        <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                    ) : (
                        <ReactECharts option={weeklyOption} style={{ height: "280px", width: "100%" }} opts={{ renderer: "svg" }} notMerge={true} />
                    )}
                </div>
            </div>

            {/* Estado bar chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Leads Ingresados por Estado</h3>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Clic en una barra para filtrar toda la página por ese estado.</p>
                <div className="min-h-[220px]">
                    {leadsWithoutEstado.length === 0 ? (
                        <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                    ) : (
                        <ReactECharts
                            option={byEstadoOption}
                            style={{ height: "220px", width: "100%" }}
                            opts={{ renderer: "svg" }}
                            notMerge={true}
                            onEvents={{ click: handleEstadoBarClick }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
