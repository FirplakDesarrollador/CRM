"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { CalendarCheck2, CheckCircle2, BarChart3, CalendarClock } from "lucide-react";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { useCanalPropioVendedores, TipoCanalVendedor } from "@/lib/hooks/useCanalPropioVendedores";
import { useCanalPropioActivities } from "@/lib/hooks/useCanalPropioActivities";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { getWeekKey } from "./weekUtils";

const TIPO_CANAL_OPTIONS: { value: TipoCanalVendedor; label: string }[] = [
    { value: "Fisico", label: "Físico" },
    { value: "Online", label: "Online" },
];

interface Filters {
    tiposCanal: TipoCanalVendedor[];
    year: string;
    asesorId: string | null; // set via chart/table click cross-filter
}

const EMPTY_FILTERS: Filters = { tiposCanal: [], year: "", asesorId: null };

export function Page4Eventos() {
    const { users } = useIndicadoresLookups();
    const { tipoByVendedor, vendedorIds } = useCanalPropioVendedores();
    // Live from Supabase, same rationale as Page 3: the offline cache can be
    // stale for this small team even right after a manual sync.
    const { activities } = useCanalPropioActivities(vendedorIds);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const userNameMap = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach(u => map.set(u.id, u.full_name?.trim() || u.email));
        return map;
    }, [users]);

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
        (activities || []).forEach(a => {
            if (a.fecha_inicio) years.add(new Date(a.fecha_inicio).getFullYear());
        });
        years.add(new Date().getFullYear());
        return Array.from(years)
            .sort((a, b) => b - a)
            .map(y => ({ value: String(y), label: String(y) }));
    }, [activities]);

    // Eventos (tipo_actividad = 'EVENTO') owned by the scoped team.
    const eventos = useMemo(() => {
        const yearNum = filters.year ? Number(filters.year) : null;
        return (activities || []).filter(a => {
            if (a.is_deleted) return false;
            if (a.tipo_actividad !== "EVENTO") return false;
            if (!a.user_id || !scopedAdvisorIds.has(a.user_id)) return false;
            if (filters.asesorId && a.user_id !== filters.asesorId) return false;
            if (yearNum != null) {
                if (!a.fecha_inicio) return false;
                if (new Date(a.fecha_inicio).getFullYear() !== yearNum) return false;
            }
            return true;
        });
    }, [activities, scopedAdvisorIds, filters.year, filters.asesorId]);

    const completados = useMemo(() => eventos.filter(a => a.is_completed), [eventos]);

    const toggleAsesorFilter = (asesorId: string) => {
        setFilters(prev => ({ ...prev, asesorId: prev.asesorId === asesorId ? null : asesorId }));
    };

    // --- Table: Asesor | Eventos Completados | Eventos Programados ----------
    const advisorRows = useMemo(() => {
        const map = new Map<string, { asesor: string; programados: number; completados: number }>();
        eventos.forEach(a => {
            const id = a.user_id!;
            const name = userNameMap.get(id) || "Sin asesor";
            const existing = map.get(id);
            if (existing) {
                existing.programados += 1;
                if (a.is_completed) existing.completados += 1;
            } else {
                map.set(id, { asesor: name, programados: 1, completados: a.is_completed ? 1 : 0 });
            }
        });
        return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
    }, [eventos, userNameMap]);

    const advisorRowsAlpha = useMemo(
        () => [...advisorRows].sort((a, b) => a.asesor.localeCompare(b.asesor)),
        [advisorRows]
    );

    // --- Bar chart: eventos programados por asesor ---------------------------
    const byAdvisorOption = useMemo(() => {
        const sorted = [...advisorRows].sort((a, b) => b.programados - a.programados);
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#254153", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
            grid: { left: 40, right: 16, top: 16, bottom: 70 },
            xAxis: {
                type: "category",
                data: sorted.map(r => r.asesor),
                axisLabel: { fontSize: 10, color: "#94a3b8", rotate: 30, interval: 0 },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            yAxis: {
                type: "value",
                name: "Eventos Programados",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Eventos Programados",
                    type: "bar",
                    barMaxWidth: 42,
                    cursor: "pointer",
                    itemStyle: { color: "#3b82f6", borderRadius: [4, 4, 0, 0] },
                    data: sorted.map(r => ({ value: r.programados, id: r.id })),
                },
            ],
        };
    }, [advisorRows]);

    const handleAdvisorBarClick = (params: any) => {
        const id = params?.data?.id;
        if (id) toggleAsesorFilter(id);
    };

    // --- Bar chart: eventos completados y programados por semana -------------
    const weeklyOption = useMemo(() => {
        const programadosByWeek = new Map<string, number>();
        const completadosByWeek = new Map<string, number>();
        const weekLabel = new Map<string, number>();

        eventos.forEach(a => {
            if (!a.fecha_inicio) return;
            const { key, week } = getWeekKey(new Date(a.fecha_inicio));
            weekLabel.set(key, week);
            programadosByWeek.set(key, (programadosByWeek.get(key) || 0) + 1);
            if (a.is_completed) completadosByWeek.set(key, (completadosByWeek.get(key) || 0) + 1);
        });

        const weekKeys = Array.from(weekLabel.keys()).sort();
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#254153", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
            legend: { top: 0, textStyle: { fontSize: 11, color: "#475569" } },
            grid: { left: 40, right: 16, top: 36, bottom: 40 },
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
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Eventos Completados",
                    type: "bar",
                    barMaxWidth: 14,
                    itemStyle: { color: "#38bdf8", borderRadius: [2, 2, 0, 0] },
                    data: weekKeys.map(k => completadosByWeek.get(k) || 0),
                },
                {
                    name: "Eventos Programados",
                    type: "bar",
                    barMaxWidth: 14,
                    itemStyle: { color: "#1e3a8a", borderRadius: [2, 2, 0, 0] },
                    data: weekKeys.map(k => programadosByWeek.get(k) || 0),
                },
            ],
        };
    }, [eventos]);

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
                {(filters.tiposCanal.length > 0 || filters.year || filters.asesorId) && (
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-3 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline">
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#254153] flex items-center justify-center text-white shrink-0">
                        <CalendarClock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{eventos.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eventos Programados</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{completados.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eventos Completados</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-sm mb-3">Eventos por asesor</h3>
                    <div className="max-h-[340px] overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-3 py-2">Asesor</th>
                                    <th className="px-3 py-2 text-right">Completados</th>
                                    <th className="px-3 py-2 text-right">Programados</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {advisorRowsAlpha.map(row => (
                                    <tr
                                        key={row.id}
                                        onClick={() => toggleAsesorFilter(row.id)}
                                        className={`cursor-pointer hover:bg-slate-50/60 transition-colors ${filters.asesorId === row.id ? "bg-blue-50/60" : ""}`}
                                    >
                                        <td className="px-3 py-2 text-blue-700 font-medium">{row.asesor}</td>
                                        <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{row.completados}</td>
                                        <td className="px-3 py-2 text-right text-slate-800 font-semibold tabular-nums">{row.programados}</td>
                                    </tr>
                                ))}
                                {advisorRowsAlpha.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-8 text-center text-slate-400">Sin datos para estos filtros.</td>
                                    </tr>
                                )}
                            </tbody>
                            {advisorRowsAlpha.length > 0 && (
                                <tfoot className="sticky bottom-0 bg-white border-t border-slate-100">
                                    <tr className="font-black text-slate-900">
                                        <td className="px-3 py-2">Total</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{completados.length}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{eventos.length}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Bar chart: por asesor */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Eventos Programados por Asesor</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">Clic en una barra (o en la tabla) para filtrar por ese asesor.</p>
                    <div className="flex-1 min-h-[300px]">
                        {advisorRows.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                        ) : (
                            <ReactECharts
                                option={byAdvisorOption}
                                style={{ height: "100%", width: "100%" }}
                                opts={{ renderer: "svg" }}
                                notMerge={true}
                                onEvents={{ click: handleAdvisorBarClick }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Weekly chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <CalendarCheck2 className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Eventos Completados y Eventos Programados por Semana</h3>
                </div>
                <div className="min-h-[280px]">
                    {eventos.length === 0 ? (
                        <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                    ) : (
                        <ReactECharts option={weeklyOption} style={{ height: "280px", width: "100%" }} opts={{ renderer: "svg" }} notMerge={true} />
                    )}
                </div>
            </div>
        </div>
    );
}
