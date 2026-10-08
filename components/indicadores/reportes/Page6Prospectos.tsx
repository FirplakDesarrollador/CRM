"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { UserPlus, Wallet, Clock, AlertTriangle, PieChart, BarChart3 } from "lucide-react";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { useCanalPropioVendedores, TipoCanalVendedor } from "@/lib/hooks/useCanalPropioVendedores";
import { useLiveOpportunities } from "@/lib/hooks/useLiveOpportunities";
import { formatCurrency } from "@/lib/utils";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, Option } from "@/components/ui/MultiSelect";
import { currentWeekMarkLine, getISOWeek, getWeekKey, withCurrentWeekMarker } from "./weekUtils";
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
const CANAL_PROPIO_ID = "PROPIO";
const WEEK_OPTIONS = Array.from({ length: 53 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const STALE_THRESHOLD_DAYS = 15;

const AGE_BUCKETS = [
    { label: "0-7 días", min: 0, max: 7, color: "#22c55e" },
    { label: "8-15 días", min: 8, max: 15, color: "#eab308" },
    { label: "16-30 días", min: 16, max: 30, color: "#f97316" },
    { label: "31-60 días", min: 31, max: 60, color: "#ef4444" },
    { label: "+60 días", min: 61, max: Infinity, color: "#991b1b" },
];

function ageInDays(createdAt: string | null): number | null {
    if (!createdAt) return null;
    const ms = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
}

interface Filters {
    canalId: string;
    tiposCanal: TipoCanalVendedor[];
    subclasificacionId: string;
    segmentoId: string;
    asesorIds: string[];
    year: string;
    month: string;
    week: string;
    day: string;
}

const EMPTY_FILTERS: Filters = {
    canalId: "",
    tiposCanal: [],
    subclasificacionId: "",
    segmentoId: "",
    asesorIds: [],
    year: "",
    month: "",
    week: "",
    day: "",
};

/**
 * "Prospectos": oportunidades sin una fase asignada en el embudo de ventas.
 * Es la misma regla que ya usa el resto de la app (lib/opportunityTableHelpers.ts,
 * app/oportunidades/page.tsx) para mostrar la insignia "Pros." cuando no hay
 * fase_data — aquí se aplica contra fase_id directamente ya que useLiveOpportunities
 * no trae el join.
 */
export function Page6Prospectos() {
    const { users, channels, accountsMap, subclasificaciones, segments, phases } = useIndicadoresLookups();
    const { tipoByVendedor } = useCanalPropioVendedores();
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

    const channelNameMap = useMemo(() => {
        const map = new Map<string, string>();
        channels.forEach(c => map.set(c.id, c.nombre));
        return map;
    }, [channels]);

    const phaseIdSet = useMemo(() => new Set(phases.map(p => p.id)), [phases]);

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

    const segmentoOptions: SearchableSelectOption[] = useMemo(() => {
        const subId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        return segments
            .filter(s => !subId || s.subclasificacion_id === subId)
            .map(s => ({ value: String(s.id), label: s.nombre }));
    }, [segments, filters.subclasificacionId]);

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

    const monthOptions: SearchableSelectOption[] = MONTH_LABELS.map((label, idx) => ({ value: String(idx), label }));

    // Every opportunity without an assigned pipeline phase (Canal, Tipo Canal,
    // SubClasificación, Segmento, Asesor and creation-date filters applied).
    const scopedOpportunities = useMemo(() => {
        const yearNum = filters.year ? Number(filters.year) : null;
        const monthNum = filters.month !== "" ? Number(filters.month) : null;
        const weekNum = filters.week ? Number(filters.week) : null;
        const dayNum = filters.day ? Number(filters.day) : null;
        const tipoSet = isCanalPropio && filters.tiposCanal.length > 0 ? new Set(filters.tiposCanal) : null;
        const asesorSet = filters.asesorIds.length > 0 ? new Set(filters.asesorIds) : null;
        const subclasId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        const segmentoId = filters.segmentoId ? Number(filters.segmentoId) : null;
        return (opportunities || []).filter(o => {
            if (o.is_deleted) return false;
            if (o.fase_id && phaseIdSet.has(o.fase_id)) return false; // ya está en una etapa del embudo
            if (getEstadoBucket(o.estado_id) !== "open") return false;
            if (asesorSet && (!o.owner_user_id || !asesorSet.has(o.owner_user_id))) return false;
            if (segmentoId && o.segmento_id !== segmentoId) return false;
            const acc = o.account_id ? accountsMap.get(o.account_id) : undefined;
            if (filters.canalId && acc?.canal_id !== filters.canalId) return false;
            if (subclasId && acc?.subclasificacion_id !== subclasId) return false;
            if (tipoSet) {
                const tipo = o.owner_user_id ? tipoByVendedor.get(o.owner_user_id) : undefined;
                if (!tipo || !tipoSet.has(tipo)) return false;
            }
            if (yearNum != null || monthNum != null || weekNum != null || dayNum != null) {
                if (!o.created_at) return false;
                const d = new Date(o.created_at);
                if (yearNum != null && d.getFullYear() !== yearNum) return false;
                if (monthNum != null && d.getMonth() !== monthNum) return false;
                if (weekNum != null && getISOWeek(d) !== weekNum) return false;
                if (dayNum != null && d.getDate() !== dayNum) return false;
            }
            return true;
        });
    }, [opportunities, filters, isCanalPropio, accountsMap, tipoByVendedor, phaseIdSet]);

    // --- KPIs ---------------------------------------------------------------
    const totalAmount = useMemo(
        () => scopedOpportunities.reduce((sum, o) => sum + Number(o.amount ?? 0), 0),
        [scopedOpportunities]
    );

    const ages = useMemo(
        () => scopedOpportunities.map(o => ageInDays(o.created_at)).filter((a): a is number => a != null),
        [scopedOpportunities]
    );
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0;
    const staleCount = ages.filter(a => a > STALE_THRESHOLD_DAYS).length;

    // --- Table: Asesor | Prospectos | Monto potencial | Antigüedad promedio --
    const advisorRows = useMemo(() => {
        const map = new Map<string, { asesor: string; count: number; amount: number; ageSum: number; ageCount: number }>();
        scopedOpportunities.forEach(o => {
            const id = o.owner_user_id || "sin-asesor";
            const name = o.owner_user_id ? userNameMap.get(id) || "Sin asesor" : "Sin asesor";
            const amount = Number(o.amount ?? 0);
            const age = ageInDays(o.created_at);
            const existing = map.get(id);
            if (existing) {
                existing.count += 1;
                existing.amount += amount;
                if (age != null) {
                    existing.ageSum += age;
                    existing.ageCount += 1;
                }
            } else {
                map.set(id, { asesor: name, count: 1, amount, ageSum: age ?? 0, ageCount: age != null ? 1 : 0 });
            }
        });
        return Array.from(map.entries())
            .map(([id, v]) => ({
                id,
                asesor: v.asesor,
                count: v.count,
                amount: v.amount,
                avgAge: v.ageCount > 0 ? Math.round(v.ageSum / v.ageCount) : 0,
            }))
            .sort((a, b) => a.asesor.localeCompare(b.asesor));
    }, [scopedOpportunities, userNameMap]);

    const toggleAsesorFilter = (asesorId: string) => {
        setFilters(prev => {
            const isOnlySelected = prev.asesorIds.length === 1 && prev.asesorIds[0] === asesorId;
            return { ...prev, asesorIds: isOnlySelected ? [] : [asesorId] };
        });
    };

    // --- Donut: prospectos por canal ----------------------------------------
    const canalDonutOption = useMemo(() => {
        const byCanal = new Map<string, number>();
        scopedOpportunities.forEach(o => {
            const acc = o.account_id ? accountsMap.get(o.account_id) : undefined;
            const cid = acc?.canal_id || "sin-canal";
            byCanal.set(cid, (byCanal.get(cid) || 0) + 1);
        });
        const hasSelection = Boolean(filters.canalId);
        const data = Array.from(byCanal.entries()).map(([cid, count], idx) => ({
            name: channelNameMap.get(cid) || "Sin canal",
            value: count,
            itemStyle: {
                color: PALETTE[idx % PALETTE.length],
                opacity: hasSelection && filters.canalId !== cid ? 0.25 : 1,
            },
        }));
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: {
                trigger: "item",
                backgroundColor: "#254153",
                borderWidth: 0,
                textStyle: { color: "#fff", fontSize: 12 },
                formatter: (p: EChartsCallbackParams) => `${p.name}<br/>${p.value} prospectos (${p.percent}%)`,
            },
            legend: { bottom: 0, textStyle: { fontSize: 11, color: "#475569" } },
            series: [
                {
                    name: "Prospectos por canal",
                    type: "pie",
                    radius: ["45%", "72%"],
                    center: ["50%", "45%"],
                    cursor: "pointer",
                    itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 6 },
                    label: { formatter: "{d}%", fontSize: 11, fontWeight: 700, color: "#475569" },
                    data,
                },
            ],
        };
    }, [scopedOpportunities, accountsMap, channelNameMap, filters.canalId]);

    const handleDonutClick = (params: EChartsCallbackParams) => {
        const entry = channels.find(c => c.nombre === params.name);
        if (!entry) return;
        setCanalFilter(filters.canalId === entry.id ? "" : entry.id);
    };

    // --- Bar: prospectos nuevos por semana ----------------------------------
    const weeklyNewOption = useMemo(() => {
        const byWeek = new Map<string, number>();
        const weekLabel = new Map<string, number>();
        scopedOpportunities.forEach(o => {
            if (!o.created_at) return;
            const { key, week } = getWeekKey(new Date(o.created_at));
            weekLabel.set(key, week);
            byWeek.set(key, (byWeek.get(key) || 0) + 1);
        });
        const { weekKeys, currentIndex } = withCurrentWeekMarker(weekLabel);
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
                name: "Prospectos nuevos",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [
                {
                    name: "Prospectos nuevos",
                    type: "bar",
                    barMaxWidth: 24,
                    itemStyle: { color: "#f97316", borderRadius: [3, 3, 0, 0] },
                    data: weekKeys.map(k => byWeek.get(k) || 0),
                    markLine: currentWeekMarkLine(currentIndex),
                },
            ],
        };
    }, [scopedOpportunities]);

    // --- Bar: distribución de antigüedad ------------------------------------
    const ageHistogramOption = useMemo(() => {
        const data = AGE_BUCKETS.map(b => ({
            value: ages.filter(a => a >= b.min && a <= b.max).length,
            itemStyle: { color: b.color, borderRadius: [3, 3, 0, 0] as [number, number, number, number] },
        }));
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#254153", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
            grid: { left: 40, right: 16, top: 16, bottom: 40 },
            xAxis: {
                type: "category",
                data: AGE_BUCKETS.map(b => b.label),
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            yAxis: {
                type: "value",
                name: "Prospectos",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series: [{ name: "Prospectos", type: "bar", barMaxWidth: 36, data }],
        };
    }, [ages]);

    const hasActiveFilters =
        filters.canalId || filters.tiposCanal.length > 0 || filters.subclasificacionId || filters.segmentoId ||
        filters.asesorIds.length > 0 || filters.year || filters.month || filters.week || filters.day;

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
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Semana</label>
                        <SearchableSelect options={WEEK_OPTIONS} value={filters.week} onChange={v => setFilter("week", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Día</label>
                        <SearchableSelect options={DAY_OPTIONS} value={filters.day} onChange={v => setFilter("day", v)} placeholder="Todas" />
                    </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                    Prospectos: oportunidades que aún no se han movido a una etapa del embudo de ventas (aparecen como &quot;Pros.&quot; en Oportunidades). Los filtros de fecha usan la fecha de creación.
                </p>
                {hasActiveFilters && (
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-2 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline">
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{scopedOpportunities.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prospectos</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#254153] flex items-center justify-center text-white shrink-0">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{formatCurrency(totalAmount)}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monto Potencial</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{avgAge}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Antigüedad Promedio (días)</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{staleCount}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estancados (+{STALE_THRESHOLD_DAYS} días)</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-sm mb-3">Prospectos por asesor</h3>
                    <div className="max-h-[340px] overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="px-3 py-2">Asesor</th>
                                    <th className="px-3 py-2 text-right">Prospectos</th>
                                    <th className="px-3 py-2 text-right">Monto</th>
                                    <th className="px-3 py-2 text-right">Días</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {advisorRows.map(row => (
                                    <tr
                                        key={row.id}
                                        onClick={row.id === "sin-asesor" ? undefined : () => toggleAsesorFilter(row.id)}
                                        className={`transition-colors ${row.id === "sin-asesor" ? "" : "cursor-pointer hover:bg-slate-50/60"} ${filters.asesorIds.includes(row.id) ? "bg-blue-50/60" : ""}`}
                                    >
                                        <td className="px-3 py-2 text-blue-700 font-medium">{row.asesor}</td>
                                        <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{row.count}</td>
                                        <td className="px-3 py-2 text-right text-slate-800 font-semibold tabular-nums">{formatCurrency(row.amount)}</td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${row.avgAge > STALE_THRESHOLD_DAYS ? "text-red-600 font-semibold" : "text-slate-700"}`}>{row.avgAge}</td>
                                    </tr>
                                ))}
                                {advisorRows.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-8 text-center text-slate-400">Sin datos para estos filtros.</td>
                                    </tr>
                                )}
                            </tbody>
                            {advisorRows.length > 0 && (
                                <tfoot className="sticky bottom-0 bg-white border-t border-slate-100">
                                    <tr className="font-black text-slate-900">
                                        <td className="px-3 py-2">Total</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{scopedOpportunities.length}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalAmount)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{avgAge}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Donut: por canal */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <PieChart className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Prospectos por canal</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">Clic en una porción para filtrar por ese canal.</p>
                    <div className="flex-1 min-h-[300px]">
                        {scopedOpportunities.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                        ) : (
                            <ReactECharts
                                option={canalDonutOption}
                                style={{ height: "100%", width: "100%" }}
                                opts={{ renderer: "svg" }}
                                notMerge={true}
                                onEvents={{ click: handleDonutClick }}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly new prospects */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Prospectos nuevos por semana</h3>
                    </div>
                    <div className="min-h-[260px]">
                        {scopedOpportunities.length === 0 ? (
                            <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                        ) : (
                            <ReactECharts option={weeklyNewOption} style={{ height: "260px", width: "100%" }} opts={{ renderer: "svg" }} notMerge={true} />
                        )}
                    </div>
                </div>

                {/* Age histogram */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Antigüedad de los prospectos</h3>
                    </div>
                    <div className="min-h-[260px]">
                        {scopedOpportunities.length === 0 ? (
                            <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">Sin datos para estos filtros.</div>
                        ) : (
                            <ReactECharts option={ageHistogramOption} style={{ height: "260px", width: "100%" }} opts={{ renderer: "svg" }} notMerge={true} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
