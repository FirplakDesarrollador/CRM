"use client";

import React, { useCallback, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Users2, Trophy, LineChart, BarChart3 } from "lucide-react";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { useCanalPropioVendedores, TipoCanalVendedor } from "@/lib/hooks/useCanalPropioVendedores";
import { useLiveAccounts } from "@/lib/hooks/useLiveAccounts";
import { useLiveOpportunities } from "@/lib/hooks/useLiveOpportunities";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, Option } from "@/components/ui/MultiSelect";
import { getWeekKey } from "./weekUtils";
import { EstadoBucket, getEstadoBucket } from "./estadoUtils";
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

const ACCOUNT_BUCKET_LABELS: Record<EstadoBucket, string> = {
    open: "En prospección",
    won: "Ganada",
    lost: "Perdida",
};
const ACCOUNT_BUCKET_COLORS: Record<EstadoBucket, string> = {
    open: "#3b82f6",
    won: "#22c55e",
    lost: "#ef4444",
};
const ACCOUNT_BUCKET_ORDER: EstadoBucket[] = ["open", "lost", "won"];
const ESTADO_OPTIONS: Option[] = ACCOUNT_BUCKET_ORDER.map(bucket => ({ value: bucket, label: ACCOUNT_BUCKET_LABELS[bucket] }));

interface Filters {
    canalId: string;
    tiposCanal: TipoCanalVendedor[];
    subclasificacionId: string;
    year: string;
    month: string;
    asesorIds: string[];
    estados: EstadoBucket[]; // also set via chart click cross-filter
}

const EMPTY_FILTERS: Filters = {
    canalId: "",
    tiposCanal: [],
    subclasificacionId: "",
    year: "",
    month: "",
    asesorIds: [],
    estados: [],
};
const CANAL_PROPIO_ID = "PROPIO";

export function Page5Cuentas() {
    const { channels, users, subclasificaciones } = useIndicadoresLookups();
    const { tipoByVendedor } = useCanalPropioVendedores();
    // Live from Supabase, same rationale as pages 3-4: the offline cache can
    // be stale for this data even right after a manual sync.
    const { accounts } = useLiveAccounts();
    const { opportunities } = useLiveOpportunities();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const canalOptions: SearchableSelectOption[] = useMemo(
        () => channels.map(c => ({ value: c.id, label: c.nombre })),
        [channels]
    );
    const isCanalPropio = filters.canalId === CANAL_PROPIO_ID;

    const setCanalFilter = (canalId: string) => {
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

    // A cuenta has no estado of its own — it's derived from the best result
    // among its own (non-deleted) oportunidades: Ganada > Abierta > Perdida,
    // and a cuenta with no oportunidades yet counts as "En prospección".
    const opportunitiesByAccount = useMemo(() => {
        const map = new Map<string, EstadoBucket[]>();
        (opportunities || []).forEach(o => {
            if (o.is_deleted || !o.account_id) return;
            const list = map.get(o.account_id) || [];
            list.push(getEstadoBucket(o.estado_id));
            map.set(o.account_id, list);
        });
        return map;
    }, [opportunities]);

    const resolveAccountStatus = useCallback(
        (accountId: string): EstadoBucket => {
            const buckets = opportunitiesByAccount.get(accountId);
            if (!buckets || buckets.length === 0) return "open";
            if (buckets.includes("won")) return "won";
            if (buckets.includes("open")) return "open";
            return "lost";
        },
        [opportunitiesByAccount]
    );

    const yearOptions: SearchableSelectOption[] = useMemo(() => {
        const years = new Set<number>();
        (accounts || []).forEach(a => {
            if (!a.created_at) return;
            const year = new Date(a.created_at).getFullYear();
            if (isPlausibleYear(year)) years.add(year);
        });
        years.add(new Date().getFullYear());
        return Array.from(years)
            .sort((a, b) => b - a)
            .map(y => ({ value: String(y), label: String(y) }));
    }, [accounts]);

    const monthOptions: SearchableSelectOption[] = MONTH_LABELS.map((label, idx) => ({ value: String(idx), label }));

    // Every cuenta matching Canal, Tipo Canal (Canal Propio only),
    // SubClasificación, Asesor and Año/Mes (created_at, when the cuenta
    // itself entered the CRM).
    const accountsWithoutEstado = useMemo(() => {
        const yearNum = filters.year ? Number(filters.year) : null;
        const monthNum = filters.month !== "" ? Number(filters.month) : null;
        const tipoSet = isCanalPropio && filters.tiposCanal.length > 0 ? new Set(filters.tiposCanal) : null;
        const asesorSet = filters.asesorIds.length > 0 ? new Set(filters.asesorIds) : null;
        const subclasId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        return (accounts || []).filter(a => {
            if (a.is_deleted) return false;
            if (asesorSet && (!a.owner_user_id || !asesorSet.has(a.owner_user_id))) return false;
            if (filters.canalId && a.canal_id !== filters.canalId) return false;
            if (subclasId && a.subclasificacion_id !== subclasId) return false;
            if (tipoSet) {
                const tipo = a.owner_user_id ? tipoByVendedor.get(a.owner_user_id) : undefined;
                if (!tipo || !tipoSet.has(tipo)) return false;
            }
            if (yearNum != null || monthNum != null) {
                if (!a.created_at) return false;
                const d = new Date(a.created_at);
                if (yearNum != null && d.getFullYear() !== yearNum) return false;
                if (monthNum != null && d.getMonth() !== monthNum) return false;
            }
            return true;
        });
    }, [accounts, filters, isCanalPropio, tipoByVendedor]);

    const accountsFiltered = useMemo(() => {
        if (filters.estados.length === 0) return accountsWithoutEstado;
        const estadoSet = new Set(filters.estados);
        return accountsWithoutEstado.filter(a => estadoSet.has(resolveAccountStatus(a.id)));
    }, [accountsWithoutEstado, filters.estados, resolveAccountStatus]);

    const ganadas = useMemo(
        () => accountsWithoutEstado.filter(a => resolveAccountStatus(a.id) === "won"),
        [accountsWithoutEstado, resolveAccountStatus]
    );

    const toggleEstadoFilter = (bucket: EstadoBucket) => {
        setFilters(prev => {
            const isOnlySelected = prev.estados.length === 1 && prev.estados[0] === bucket;
            return { ...prev, estados: isOnlySelected ? [] : [bucket] };
        });
    };

    // --- Line chart: cuentas nuevas por semana --------------------------------
    const weeklyOption = useMemo(() => {
        const byWeek = new Map<string, number>();
        const weekLabel = new Map<string, number>();
        accountsFiltered.forEach(a => {
            if (!a.created_at) return;
            const { key, week } = getWeekKey(new Date(a.created_at));
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
                name: "Cuentas Nuevas",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Cuentas Nuevas",
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
    }, [accountsFiltered]);

    // --- Horizontal bar chart: cuentas por estado ------------------------------
    const byEstadoOption = useMemo(() => {
        const counts: Record<EstadoBucket, number> = { open: 0, won: 0, lost: 0 };
        accountsWithoutEstado.forEach(a => {
            counts[resolveAccountStatus(a.id)] += 1;
        });
        const hasSelection = filters.estados.length > 0;
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
                data: ACCOUNT_BUCKET_ORDER.map(b => ACCOUNT_BUCKET_LABELS[b]),
                axisLabel: { fontSize: 11, color: "#475569", fontWeight: 600 },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            series: [
                {
                    name: "Cuentas",
                    type: "bar",
                    barMaxWidth: 28,
                    cursor: "pointer",
                    itemStyle: { borderRadius: [0, 4, 4, 0] },
                    data: ACCOUNT_BUCKET_ORDER.map(b => ({
                        value: counts[b],
                        bucket: b,
                        itemStyle: {
                            color: ACCOUNT_BUCKET_COLORS[b],
                            opacity: hasSelection && !filters.estados.includes(b) ? 0.3 : 1,
                        },
                    })),
                },
            ],
        };
    }, [accountsWithoutEstado, filters.estados, resolveAccountStatus]);

    const handleEstadoBarClick = (params: EChartsCallbackParams) => {
        const bucket = params?.data?.bucket as EstadoBucket | undefined;
        if (bucket) toggleEstadoFilter(bucket);
    };

    const hasActiveFilters =
        filters.canalId || filters.tiposCanal.length > 0 || filters.subclasificacionId || filters.year ||
        filters.month || filters.asesorIds.length > 0 || filters.estados.length > 0;

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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado</label>
                        <MultiSelect options={ESTADO_OPTIONS} selected={filters.estados} onChange={v => setFilter("estados", v as EstadoBucket[])} placeholder="Todos" />
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
                        <Users2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{accountsWithoutEstado.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuentas Nuevas</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{ganadas.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ganadas</p>
                    </div>
                </div>
            </div>

            {/* Line chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <LineChart className="w-4 h-4 text-[#254153]" />
                    <h3 className="font-bold text-slate-800 text-sm">Cuentas Nuevas por Semana</h3>
                </div>
                <div className="min-h-[280px]">
                    {accountsFiltered.length === 0 ? (
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
                    <h3 className="font-bold text-slate-800 text-sm">Cuentas por Estado</h3>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Clic en una barra para filtrar toda la página por ese estado.</p>
                <div className="min-h-[220px]">
                    {accountsWithoutEstado.length === 0 ? (
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
