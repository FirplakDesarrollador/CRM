"use client";

import React, { useCallback, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { BarChart3, ListChecks } from "lucide-react";
import { useActivities } from "@/lib/hooks/useActivities";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, Option } from "@/components/ui/MultiSelect";
import { EChartsCallbackParams } from "./echartsTypes";

const MONTH_LABELS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Filters {
    ownerIds: string[];
    clasificacionIds: string[];
    canalId: string;
    year: string;
    month: string;
    day: string;
}

const EMPTY_FILTERS: Filters = {
    ownerIds: [],
    clasificacionIds: [],
    canalId: "",
    year: "",
    month: "",
    day: "",
};

export function Page2Clasificaciones() {
    const { user, isVendedor } = useCurrentUser();
    const { activities } = useActivities();
    const { opportunities } = useOpportunities();
    const { channels, users, accountsMap, activityClassifications } = useIndicadoresLookups();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Activities only link to an opportunity sometimes; when account_id is empty,
    // resolve the account through the linked opportunity (same pattern as
    // app/actividades/page.tsx).
    const oppAccountMap = useMemo(() => {
        const map = new Map<string, string>();
        (opportunities || []).forEach(o => {
            if (o.account_id) map.set(o.id, o.account_id);
        });
        return map;
    }, [opportunities]);

    const clasificacionMap = useMemo(() => {
        const map = new Map<number, string>();
        activityClassifications.forEach(c => map.set(c.id, c.nombre));
        return map;
    }, [activityClassifications]);

    const clasificacionOptions: Option[] = useMemo(
        () =>
            activityClassifications
                .filter(c => !c.is_deleted)
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(c => ({ value: String(c.id), label: c.nombre })),
        [activityClassifications]
    );

    const ownerOptions: Option[] = useMemo(
        () => users.map(u => ({ value: u.id, label: u.full_name?.trim() || u.email })),
        [users]
    );

    const canalOptions: SearchableSelectOption[] = useMemo(
        () => channels.map(c => ({ value: c.id, label: c.nombre })),
        [channels]
    );

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

    const monthOptions: SearchableSelectOption[] = MONTH_LABELS.map((label, idx) => ({ value: String(idx), label }));
    const dayOptions: SearchableSelectOption[] = Array.from({ length: 31 }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
    }));

    // Resolve account (id, nombre, canal_id) for an activity, via its direct
    // account_id or, failing that, its linked opportunity's account.
    const resolveAccount = useCallback(
        (activity: { account_id?: string | null; opportunity_id?: string | null }) => {
            const accountId = activity.account_id || (activity.opportunity_id ? oppAccountMap.get(activity.opportunity_id) : undefined);
            return accountId ? accountsMap.get(accountId) : undefined;
        },
        [accountsMap, oppAccountMap]
    );

    const filtered = useMemo(() => {
        const ownerSet = filters.ownerIds.length > 0 ? new Set(filters.ownerIds) : null;
        const clasifSet = filters.clasificacionIds.length > 0 ? new Set(filters.clasificacionIds.map(Number)) : null;
        const yearNum = filters.year ? Number(filters.year) : null;
        const monthNum = filters.month !== "" ? Number(filters.month) : null;
        const dayNum = filters.day ? Number(filters.day) : null;

        return (activities || []).filter(a => {
            if (a.is_deleted) return false;
            if (isVendedor && user?.id && a.user_id !== user.id) return false;
            if (ownerSet && (!a.user_id || !ownerSet.has(a.user_id))) return false;
            if (clasifSet && (a.clasificacion_id == null || !clasifSet.has(a.clasificacion_id))) return false;
            if (filters.canalId) {
                const acc = resolveAccount(a);
                if (acc?.canal_id !== filters.canalId) return false;
            }
            if (yearNum != null || monthNum != null || dayNum != null) {
                if (!a.fecha_inicio) return false;
                const d = new Date(a.fecha_inicio);
                if (yearNum != null && d.getFullYear() !== yearNum) return false;
                if (monthNum != null && d.getMonth() !== monthNum) return false;
                if (dayNum != null && d.getDate() !== dayNum) return false;
            }
            return true;
        });
    }, [activities, filters, isVendedor, user, resolveAccount]);

    // --- Bar chart: cantidad de clasificaciones -----------------------------
    const chartData = useMemo(() => {
        const counts = new Map<number, number>();
        filtered.forEach(a => {
            if (a.clasificacion_id == null) return;
            counts.set(a.clasificacion_id, (counts.get(a.clasificacion_id) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([id, count]) => ({ id, name: clasificacionMap.get(id) || `#${id}`, count }))
            .sort((a, b) => b.count - a.count);
    }, [filtered, clasificacionMap]);

    const toggleClasificacionFilter = (id: number) => {
        setFilters(prev => {
            const key = String(id);
            const isOnlySelected = prev.clasificacionIds.length === 1 && prev.clasificacionIds[0] === key;
            return { ...prev, clasificacionIds: isOnlySelected ? [] : [key] };
        });
    };

    const barOption = useMemo(() => {
        const hasSelection = filters.clasificacionIds.length > 0;
        const selectedSet = new Set(filters.clasificacionIds.map(Number));
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                backgroundColor: "#254153",
                borderWidth: 0,
                textStyle: { color: "#fff", fontSize: 12 },
            },
            grid: { left: 48, right: 16, top: 16, bottom: 70 },
            xAxis: {
                type: "category",
                data: chartData.map(d => d.name),
                axisLabel: { fontSize: 10, color: "#94a3b8", rotate: 35, interval: 0 },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            yAxis: {
                type: "value",
                name: "Cantidad",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Cantidad de clasificaciones",
                    type: "bar",
                    barMaxWidth: 42,
                    cursor: "pointer",
                    itemStyle: { color: "#254153", borderRadius: [4, 4, 0, 0] },
                    data: chartData.map(d => ({
                        value: d.count,
                        id: d.id,
                        itemStyle: {
                            color: "#254153",
                            opacity: hasSelection && !selectedSet.has(d.id) ? 0.3 : 1,
                        },
                    })),
                },
            ],
        };
    }, [chartData, filters.clasificacionIds]);

    const handleBarClick = (params: EChartsCallbackParams) => {
        const id = params?.data?.id;
        if (id != null) toggleClasificacionFilter(Number(id));
    };

    // --- Table: Asesor | Clasificación | Cliente | Cantidad ------------------
    const tableRows = useMemo(() => {
        const groups = new Map<string, { asesor: string; clasificacion: string; cliente: string; count: number }>();
        filtered.forEach(a => {
            const asesorName = (a.user_id && users.find(u => u.id === a.user_id)?.full_name) || (a.user_id && users.find(u => u.id === a.user_id)?.email) || "Sin asesor";
            const clasifName = a.clasificacion_id != null ? (clasificacionMap.get(a.clasificacion_id) || "Sin clasificación") : "Sin clasificación";
            const acc = resolveAccount(a);
            const clienteName = acc?.nombre || "Sin cliente";
            const key = `${a.user_id || "-"}|${a.clasificacion_id ?? "-"}|${acc ? (a.account_id || a.opportunity_id) : "-"}`;
            const existing = groups.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                groups.set(key, { asesor: asesorName, clasificacion: clasifName, cliente: clienteName, count: 1 });
            }
        });
        return Array.from(groups.values()).sort((a, b) =>
            a.asesor.localeCompare(b.asesor) || a.clasificacion.localeCompare(b.clasificacion) || a.cliente.localeCompare(b.cliente)
        );
    }, [filtered, users, clasificacionMap, resolveAccount]);

    const grandTotal = filtered.length;

    return (
        <div className="flex flex-col gap-6">
            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Asesor</label>
                        <MultiSelect options={ownerOptions} selected={filters.ownerIds} onChange={v => setFilter("ownerIds", v)} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Clasificación</label>
                        <MultiSelect options={clasificacionOptions} selected={filters.clasificacionIds} onChange={v => setFilter("clasificacionIds", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Canal</label>
                        <SearchableSelect options={canalOptions} value={filters.canalId} onChange={v => setFilter("canalId", v)} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Año</label>
                        <SearchableSelect options={yearOptions} value={filters.year} onChange={v => setFilter("year", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mes</label>
                        <SearchableSelect options={monthOptions} value={filters.month} onChange={v => setFilter("month", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Día</label>
                        <SearchableSelect options={dayOptions} value={filters.day} onChange={v => setFilter("day", v)} placeholder="Todas" />
                    </div>
                </div>
                {(filters.ownerIds.length > 0 || filters.clasificacionIds.length > 0 || filters.canalId || filters.year || filters.month || filters.day) && (
                    <button
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        className="mt-3 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Cantidad de clasificaciones</h3>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Haz clic en una barra para filtrar toda la página por esa clasificación.</p>
                <div className="min-h-[340px]">
                    {chartData.length === 0 ? (
                        <div className="h-[340px] flex items-center justify-center text-sm text-slate-400">
                            No hay actividades para estos filtros.
                        </div>
                    ) : (
                        <ReactECharts
                            option={barOption}
                            style={{ height: "340px", width: "100%" }}
                            opts={{ renderer: "svg" }}
                            notMerge={true}
                            onEvents={{ click: handleBarClick }}
                        />
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Detalle por asesor</h3>
                </div>
                <div className="max-h-[420px] overflow-y-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-2.5">Asesor</th>
                                <th className="px-4 py-2.5">Clasificación</th>
                                <th className="px-4 py-2.5">Cliente</th>
                                <th className="px-4 py-2.5 text-right">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {tableRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-2 text-blue-700 font-medium">{row.asesor}</td>
                                    <td className="px-4 py-2 text-slate-600">{row.clasificacion}</td>
                                    <td className="px-4 py-2 text-slate-600">{row.cliente}</td>
                                    <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{row.count}</td>
                                </tr>
                            ))}
                            {tableRows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                        No hay actividades para estos filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end mt-2 px-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Total</span>
                    <span className="text-sm font-black text-slate-900 tabular-nums">{grandTotal}</span>
                </div>
            </div>
        </div>
    );
}
