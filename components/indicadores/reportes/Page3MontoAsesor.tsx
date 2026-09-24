"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Wallet, Trophy, LineChart, BarChart3 } from "lucide-react";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { useCanalPropioVendedores, TipoCanalVendedor } from "@/lib/hooks/useCanalPropioVendedores";
import { useLiveOpportunities } from "@/lib/hooks/useLiveOpportunities";
import { formatCurrency } from "@/lib/utils";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, Option } from "@/components/ui/MultiSelect";
import { getWeekKey } from "./weekUtils";
import { getEstadoBucket } from "./estadoUtils";
import { EChartsCallbackParams } from "./echartsTypes";
import { isPlausibleYear } from "./dateUtils";

const MONTH_LABELS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_CANAL_OPTIONS: { value: TipoCanalVendedor; label: string }[] = [
    { value: "Fisico", label: "Físico" },
    { value: "Online", label: "Online" },
];

const PALETTE = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#ef4444"];

interface Filters {
    canalId: string;
    tiposCanal: TipoCanalVendedor[];
    year: string;
    month: string;
    asesorIds: string[]; // also set via chart/table click cross-filter
    subclasificacionId: string;
    segmentoId: string;
}

const EMPTY_FILTERS: Filters = {
    canalId: "",
    tiposCanal: [],
    year: "",
    month: "",
    asesorIds: [],
    subclasificacionId: "",
    segmentoId: "",
};
const CANAL_PROPIO_ID = "PROPIO";

export function Page3MontoAsesor() {
    const { users, channels, accountsMap, subclasificaciones, segments } = useIndicadoresLookups();
    const { tipoByVendedor } = useCanalPropioVendedores();
    // Queried live from Supabase (not the offline Dexie cache): comparing
    // against the source BI report showed the local mirror can be stale for
    // this data even right after a manual sync.
    const { opportunities } = useLiveOpportunities();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const userNameMap = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach(u => map.set(u.id, u.full_name?.trim() || u.email));
        return map;
    }, [users]);

    const canalOptions: SearchableSelectOption[] = useMemo(
        () => channels.map(c => ({ value: c.id, label: c.nombre })),
        [channels]
    );
    const isCanalPropio = filters.canalId === CANAL_PROPIO_ID;

    const setCanalFilter = (canalId: string) => {
        // Tipo Canal (Fisico/Online) only makes sense within Canal Propio.
        // SubClasificación is also scoped to a channel, so reset it too.
        setFilters(prev => ({
            ...prev,
            canalId,
            tiposCanal: canalId === CANAL_PROPIO_ID ? prev.tiposCanal : [],
            subclasificacionId: "",
        }));
    };

    const asesorOptions: Option[] = useMemo(
        () => users.map(u => ({ value: u.id, label: u.full_name?.trim() || u.email })),
        [users]
    );

    const subclasOptions: SearchableSelectOption[] = useMemo(
        () =>
            subclasificaciones
                .filter(s => !filters.canalId || s.canal_id === filters.canalId)
                .map(s => ({ value: String(s.id), label: s.nombre })),
        [subclasificaciones, filters.canalId]
    );

    const segmentoOptions: SearchableSelectOption[] = useMemo(() => {
        const subId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        return segments
            .filter(s => !subId || s.subclasificacion_id === subId)
            .map(s => ({ value: String(s.id), label: s.nombre }));
    }, [segments, filters.subclasificacionId]);

    const yearOptions: SearchableSelectOption[] = useMemo(() => {
        const years = new Set<number>();
        (opportunities || []).forEach(o => {
            if (!o.fecha_cierre_estimada) return;
            const year = new Date(o.fecha_cierre_estimada).getFullYear();
            if (isPlausibleYear(year)) years.add(year);
        });
        years.add(new Date().getFullYear());
        return Array.from(years)
            .sort((a, b) => b - a)
            .map(y => ({ value: String(y), label: String(y) }));
    }, [opportunities]);

    const monthOptions: SearchableSelectOption[] = MONTH_LABELS.map((label, idx) => ({ value: String(idx), label }));

    // Every opportunity matching Canal, Tipo Canal (Canal Propio only),
    // SubClasificación, Segmento, Año/Mes and the Asesor filter/cross-filter.
    const scopedOpportunities = useMemo(() => {
        const yearNum = filters.year ? Number(filters.year) : null;
        const monthNum = filters.month !== "" ? Number(filters.month) : null;
        const tipoSet = isCanalPropio && filters.tiposCanal.length > 0 ? new Set(filters.tiposCanal) : null;
        const asesorSet = filters.asesorIds.length > 0 ? new Set(filters.asesorIds) : null;
        const subclasId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        const segmentoId = filters.segmentoId ? Number(filters.segmentoId) : null;
        return (opportunities || []).filter(o => {
            if (o.is_deleted) return false;
            if (asesorSet && (!o.owner_user_id || !asesorSet.has(o.owner_user_id))) return false;
            if (segmentoId && o.segmento_id !== segmentoId) return false;
            const acc = o.account_id ? accountsMap.get(o.account_id) : undefined;
            if (filters.canalId && acc?.canal_id !== filters.canalId) return false;
            if (subclasId && acc?.subclasificacion_id !== subclasId) return false;
            if (tipoSet) {
                const tipo = o.owner_user_id ? tipoByVendedor.get(o.owner_user_id) : undefined;
                if (!tipo || !tipoSet.has(tipo)) return false;
            }
            if (yearNum != null || monthNum != null) {
                if (!o.fecha_cierre_estimada) return false;
                const d = new Date(o.fecha_cierre_estimada);
                if (yearNum != null && d.getFullYear() !== yearNum) return false;
                if (monthNum != null && d.getMonth() !== monthNum) return false;
            }
            return true;
        });
    }, [opportunities, filters, isCanalPropio, accountsMap, tipoByVendedor]);

    // "won" = estado_id 2 (Ganada) — confirmed against the live DB: this alone
    // reproduces the BI reference amount exactly for this team. The weekly
    // "cerradas" chart uses this same ganadas-only population, not won+lost.
    const wonOpportunities = useMemo(
        () => scopedOpportunities.filter(o => getEstadoBucket(o.estado_id) === "won"),
        [scopedOpportunities]
    );
    const closedOpportunities = wonOpportunities;

    // --- KPIs ---------------------------------------------------------------
    const totalWonAmount = useMemo(
        () => wonOpportunities.reduce((sum, o) => sum + Number(o.amount ?? 0), 0),
        [wonOpportunities]
    );

    // --- Table: Asesor | Oportunidades Ganadas | Monto Ganado ---------------
    const advisorRows = useMemo(() => {
        const map = new Map<string, { asesor: string; count: number; amount: number }>();
        wonOpportunities.forEach(o => {
            const id = o.owner_user_id!;
            const name = userNameMap.get(id) || "Sin asesor";
            const existing = map.get(id);
            const amount = Number(o.amount ?? 0);
            if (existing) {
                existing.count += 1;
                existing.amount += amount;
            } else {
                map.set(id, { asesor: name, count: 1, amount });
            }
        });
        return Array.from(map.entries())
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => a.asesor.localeCompare(b.asesor));
    }, [wonOpportunities, userNameMap]);

    const advisorColorMap = useMemo(() => {
        const map = new Map<string, string>();
        advisorRows.forEach((row, idx) => map.set(row.id, PALETTE[idx % PALETTE.length]));
        return map;
    }, [advisorRows]);

    const toggleAsesorFilter = (asesorId: string) => {
        setFilters(prev => {
            const isOnlySelected = prev.asesorIds.length === 1 && prev.asesorIds[0] === asesorId;
            return { ...prev, asesorIds: isOnlySelected ? [] : [asesorId] };
        });
    };

    // --- Line chart: monto ganado por asesor, semanalmente -------------------
    const weeklyLineOption = useMemo(() => {
        const byAdvisorWeek = new Map<string, Map<string, number>>(); // advisorId -> weekKey -> amount
        const weekLabel = new Map<string, number>(); // weekKey -> week number label

        wonOpportunities.forEach(o => {
            if (!o.fecha_cierre_estimada || !o.owner_user_id) return;
            const { key, week } = getWeekKey(new Date(o.fecha_cierre_estimada));
            weekLabel.set(key, week);
            if (!byAdvisorWeek.has(o.owner_user_id)) byAdvisorWeek.set(o.owner_user_id, new Map());
            const advisorMap = byAdvisorWeek.get(o.owner_user_id)!;
            advisorMap.set(key, (advisorMap.get(key) || 0) + Number(o.amount ?? 0));
        });

        const weekKeys = Array.from(weekLabel.keys()).sort();
        const categories = weekKeys.map(k => String(weekLabel.get(k)));

        const series = advisorRows.map(row => ({
            name: row.asesor,
            type: "line",
            smooth: true,
            showSymbol: false,
            cursor: "pointer",
            lineStyle: { width: 2, color: advisorColorMap.get(row.id) },
            itemStyle: { color: advisorColorMap.get(row.id) },
            data: weekKeys.map(k => byAdvisorWeek.get(row.id)?.get(k) || 0),
        }));

        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: {
                trigger: "axis",
                backgroundColor: "#254153",
                borderWidth: 0,
                textStyle: { color: "#fff", fontSize: 12 },
                valueFormatter: (v: number) => formatCurrency(v),
            },
            legend: { top: 0, textStyle: { fontSize: 11, color: "#475569" } },
            grid: { left: 60, right: 16, top: 36, bottom: 28 },
            xAxis: {
                type: "category",
                name: "Semana",
                nameLocation: "middle",
                nameGap: 26,
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                data: categories,
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            yAxis: {
                type: "value",
                axisLabel: { fontSize: 10, color: "#94a3b8", formatter: (v: number) => formatCurrency(v) },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series,
        };
    }, [wonOpportunities, advisorRows, advisorColorMap]);

    const handleLineClick = (params: EChartsCallbackParams) => {
        const row = advisorRows.find(r => r.asesor === params.seriesName);
        if (row) toggleAsesorFilter(row.id);
    };

    // --- Bar chart: oportunidades cerradas por semana -------------------------
    const closedByWeekOption = useMemo(() => {
        const byWeek = new Map<string, number>();
        const weekLabel = new Map<string, number>();
        closedOpportunities.forEach(o => {
            if (!o.fecha_cierre_estimada) return;
            const { key, week } = getWeekKey(new Date(o.fecha_cierre_estimada));
            weekLabel.set(key, week);
            byWeek.set(key, (byWeek.get(key) || 0) + 1);
        });
        const weekKeys = Array.from(byWeek.keys()).sort();
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#254153", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
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
                name: "Oportunidades cerradas",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Oportunidades cerradas",
                    type: "bar",
                    barMaxWidth: 24,
                    itemStyle: { color: "#3b82f6", borderRadius: [3, 3, 0, 0] },
                    data: weekKeys.map(k => byWeek.get(k) || 0),
                },
            ],
        };
    }, [closedOpportunities]);

    const hasActiveFilters =
        filters.canalId || filters.tiposCanal.length > 0 || filters.year || filters.month ||
        filters.asesorIds.length > 0 || filters.subclasificacionId || filters.segmentoId;

    return (
        <div className="flex flex-col gap-6">
            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Canal</label>
                        <SearchableSelect options={canalOptions} value={filters.canalId} onChange={setCanalFilter} placeholder="Todos" />
                    </div>
                    {isCanalPropio && (
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
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">SubClasificación</label>
                        <SearchableSelect options={subclasOptions} value={filters.subclasificacionId} onChange={v => setFilter("subclasificacionId", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Segmentos</label>
                        <SearchableSelect options={segmentoOptions} value={filters.segmentoId} onChange={v => setFilter("segmentoId", v)} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Asesor</label>
                        <MultiSelect options={asesorOptions} selected={filters.asesorIds} onChange={v => setFilter("asesorIds", v)} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Año</label>
                        <SearchableSelect options={yearOptions} value={filters.year} onChange={v => setFilter("year", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mes</label>
                        <SearchableSelect options={monthOptions} value={filters.month} onChange={v => setFilter("month", v)} placeholder="Todas" />
                    </div>
                </div>
                {hasActiveFilters && (
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-3 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline">
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#254153] flex items-center justify-center text-white shrink-0">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{formatCurrency(totalWonAmount)}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monto Ganado</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{wonOpportunities.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Oportunidades</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-sm mb-3">Ganado por asesor</h3>
                    <div className="max-h-[340px] overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-3 py-2">Asesor</th>
                                    <th className="px-3 py-2 text-right">Ganadas</th>
                                    <th className="px-3 py-2 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {advisorRows.map(row => (
                                    <tr
                                        key={row.id}
                                        onClick={() => toggleAsesorFilter(row.id)}
                                        className={`cursor-pointer hover:bg-slate-50/60 transition-colors ${filters.asesorIds.includes(row.id) ? "bg-blue-50/60" : ""}`}
                                    >
                                        <td className="px-3 py-2 text-blue-700 font-medium">{row.asesor}</td>
                                        <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{row.count}</td>
                                        <td className="px-3 py-2 text-right text-slate-800 font-semibold tabular-nums">{formatCurrency(row.amount)}</td>
                                    </tr>
                                ))}
                                {advisorRows.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-8 text-center text-slate-400">Sin datos para estos filtros.</td>
                                    </tr>
                                )}
                            </tbody>
                            {advisorRows.length > 0 && (
                                <tfoot className="sticky bottom-0 bg-white border-t border-slate-100">
                                    <tr className="font-black text-slate-900">
                                        <td className="px-3 py-2">Total</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{wonOpportunities.length}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalWonAmount)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Line chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <LineChart className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Monto ganado por asesor semanalmente</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">Clic en una línea (o en la tabla) para filtrar por ese asesor.</p>
                    <div className="flex-1 min-h-[300px]">
                        {advisorRows.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                        ) : (
                            <ReactECharts
                                option={weeklyLineOption}
                                style={{ height: "100%", width: "100%" }}
                                opts={{ renderer: "svg" }}
                                notMerge={true}
                                onEvents={{ click: handleLineClick }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Closed opportunities per week */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Oportunidades cerradas por semana</h3>
                </div>
                <div className="min-h-[260px]">
                    {closedOpportunities.length === 0 ? (
                        <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                    ) : (
                        <ReactECharts option={closedByWeekOption} style={{ height: "260px", width: "100%" }} opts={{ renderer: "svg" }} notMerge={true} />
                    )}
                </div>
            </div>
        </div>
    );
}
