"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { PieChart, TrendingUp, Wallet, CircleDot, Trophy, XCircle } from "lucide-react";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { filterOpportunities } from "@/lib/filterUtils";
import { formatCurrency } from "@/lib/utils";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, Option } from "@/components/ui/MultiSelect";
import { cn } from "@/components/ui/utils";
import {
    EstadoBucket,
    ESTADO_BUCKET_COLORS,
    ESTADO_BUCKET_LABELS,
    ESTADO_BUCKET_ORDER,
    getEstadoBucket,
} from "./estadoUtils";

const MONTH_LABELS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_SHORT = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
];

const ESTADO_OPTIONS: Option[] = ESTADO_BUCKET_ORDER.map(bucket => ({
    value: bucket,
    label: ESTADO_BUCKET_LABELS[bucket],
}));

const LABEL_TO_BUCKET: Record<string, EstadoBucket> = ESTADO_BUCKET_ORDER.reduce(
    (acc, bucket) => ({ ...acc, [ESTADO_BUCKET_LABELS[bucket]]: bucket }),
    {} as Record<string, EstadoBucket>
);

function computeBucketTotals(list: { amount?: number | null; estado_id?: number | null; [k: string]: any }[]) {
    const acc: Record<EstadoBucket | "total", { amount: number; count: number }> = {
        total: { amount: 0, count: 0 },
        open: { amount: 0, count: 0 },
        won: { amount: 0, count: 0 },
        lost: { amount: 0, count: 0 },
    };
    list.forEach(o => {
        const amount = Number(o.amount ?? o.valor ?? 0);
        acc.total.amount += amount;
        acc.total.count += 1;
        const bucket = getEstadoBucket(o.estado_id);
        acc[bucket].amount += amount;
        acc[bucket].count += 1;
    });
    return acc;
}

interface Filters {
    year: string; // "" = todas
    month: string; // "" = todas, "0".."11"
    ownerIds: string[];
    estados: EstadoBucket[];
    canalId: string;
    subclasificacionId: string;
    segmentoId: string;
    faseIds: string[];
}

const EMPTY_FILTERS: Filters = {
    year: "",
    month: "",
    ownerIds: [],
    estados: [],
    canalId: "",
    subclasificacionId: "",
    segmentoId: "",
    faseIds: [],
};

function KpiCard({
    label,
    amount,
    count,
    icon: Icon,
    accent,
}: {
    label: string;
    amount: number;
    count: number;
    icon: React.ElementType;
    accent: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0", accent)}>
                    <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
            <div>
                <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{formatCurrency(amount)}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{count} {count === 1 ? "oportunidad" : "oportunidades"}</p>
            </div>
        </div>
    );
}

export function Page1EstadosTiempo() {
    const { opportunities } = useOpportunities();
    const { phases, subclasificaciones, segments, channels, users, accountsMap } = useIndicadoresLookups();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            // Etapas depend on the selected channel; reset them if the channel changes.
            if (key === "canalId") next.faseIds = [];
            return next;
        });
    };

    const yearOptions: SearchableSelectOption[] = useMemo(() => {
        const years = new Set<number>();
        (opportunities || []).forEach(o => {
            if (o.fecha_cierre_estimada) years.add(new Date(o.fecha_cierre_estimada).getFullYear());
        });
        const currentYear = new Date().getFullYear();
        years.add(currentYear);
        return Array.from(years)
            .sort((a, b) => b - a)
            .map(y => ({ value: String(y), label: String(y) }));
    }, [opportunities]);

    const monthOptions: SearchableSelectOption[] = MONTH_LABELS.map((label, idx) => ({ value: String(idx), label }));

    const ownerOptions: Option[] = useMemo(
        () => users.map(u => ({ value: u.id, label: u.full_name?.trim() || u.email })),
        [users]
    );

    const canalOptions: SearchableSelectOption[] = useMemo(
        () => channels.map(c => ({ value: c.id, label: c.nombre })),
        [channels]
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

    const faseOptions: Option[] = useMemo(() => {
        if (!filters.canalId) return [];
        return phases
            .filter(p => p.canal_id === filters.canalId)
            .sort((a, b) => a.orden - b.orden)
            .map(p => ({ value: String(p.id), label: p.nombre }));
    }, [phases, filters.canalId]);

    // --- Core filtered dataset -------------------------------------------------
    // "withoutEstado" applies every filter except the Estado cross-filter, so the
    // pie chart can keep showing all three slices (dimming the unselected ones)
    // instead of collapsing to a single sliver when a slice is clicked.
    const filteredWithoutEstado = useMemo(() => {
        const base = filterOpportunities(
            opportunities || [],
            {
                channelFilter: filters.canalId || undefined,
                subclassificationFilter: filters.subclasificacionId ? Number(filters.subclasificacionId) : undefined,
                segmentFilter: filters.segmentoId ? Number(filters.segmentoId) : undefined,
                accountOwnerIds: filters.ownerIds.length > 0 ? filters.ownerIds : undefined,
            },
            { accountsMap }
        );

        const yearNum = filters.year ? Number(filters.year) : null;
        const monthNum = filters.month !== "" ? Number(filters.month) : null;
        const faseIdSet = filters.faseIds.length > 0 ? new Set(filters.faseIds.map(Number)) : null;

        return base.filter(o => {
            if (o.is_deleted) return false;
            if (faseIdSet && !faseIdSet.has(Number(o.fase_id))) return false;
            if (yearNum != null || monthNum != null) {
                if (!o.fecha_cierre_estimada) return false;
                const d = new Date(o.fecha_cierre_estimada);
                if (yearNum != null && d.getFullYear() !== yearNum) return false;
                if (monthNum != null && d.getMonth() !== monthNum) return false;
            }
            return true;
        });
    }, [opportunities, filters, accountsMap]);

    const filtered = useMemo(() => {
        if (filters.estados.length === 0) return filteredWithoutEstado;
        const estadoSet = new Set(filters.estados);
        return filteredWithoutEstado.filter(o => estadoSet.has(getEstadoBucket(o.estado_id)));
    }, [filteredWithoutEstado, filters.estados]);

    // --- KPI totals --------------------------------------------------------
    const totals = useMemo(() => computeBucketTotals(filtered), [filtered]);

    // Totals for the pie chart specifically: computed WITHOUT the Estado filter,
    // so all three slices stay visible (dimmed) instead of the pie collapsing to
    // a single slice when the user clicks on it.
    const pieTotals = useMemo(() => computeBucketTotals(filteredWithoutEstado), [filteredWithoutEstado]);

    // Cross-filter: clicking a chart element toggles the Estado filter for the
    // whole page (click again on the same estado to clear it).
    const toggleEstadoFilter = (bucket: EstadoBucket) => {
        setFilters(prev => {
            const isOnlySelected = prev.estados.length === 1 && prev.estados[0] === bucket;
            return { ...prev, estados: isOnlySelected ? [] : [bucket] };
        });
    };

    // Works for both the pie (params.name = slice label) and the line chart
    // (params.seriesName = "Abierta" / "Cerrado Ganado" / "Cerrado Perdido").
    const handleChartClick = (params: any) => {
        const bucket = LABEL_TO_BUCKET[(params.seriesName ?? params.name) as string];
        if (bucket) toggleEstadoFilter(bucket);
    };
    const chartClickEvents = { click: handleChartClick };

    // --- Pie: oportunidades por estado --------------------------------------
    const pieOption = useMemo(() => {
        const hasSelection = filters.estados.length > 0;
        const data = ESTADO_BUCKET_ORDER.map(bucket => {
            const isSelected = filters.estados.includes(bucket);
            return {
                name: ESTADO_BUCKET_LABELS[bucket],
                value: pieTotals[bucket].count,
                itemStyle: {
                    color: ESTADO_BUCKET_COLORS[bucket],
                    opacity: hasSelection && !isSelected ? 0.25 : 1,
                },
            };
        });
        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: {
                trigger: "item",
                backgroundColor: "#254153",
                borderWidth: 0,
                textStyle: { color: "#fff", fontSize: 12 },
                formatter: (p: any) => `${p.name}<br/>${p.value} oportunidades (${p.percent}%)`,
            },
            legend: { bottom: 0, textStyle: { fontSize: 11, color: "#475569" } },
            series: [
                {
                    name: "Oportunidades por estado",
                    type: "pie",
                    radius: ["45%", "72%"],
                    center: ["50%", "45%"],
                    cursor: "pointer",
                    itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 6 },
                    label: {
                        formatter: "{d}%",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#475569",
                    },
                    data,
                },
            ],
        };
    }, [pieTotals, filters.estados]);

    // --- Line/area: oportunidades por tiempo --------------------------------
    const timeOption = useMemo(() => {
        const byMonth = new Map<string, Record<EstadoBucket, number>>();
        filtered.forEach(o => {
            if (!o.fecha_cierre_estimada) return;
            const d = new Date(o.fecha_cierre_estimada);
            const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
            if (!byMonth.has(key)) byMonth.set(key, { open: 0, won: 0, lost: 0 });
            byMonth.get(key)![getEstadoBucket(o.estado_id)] += 1;
        });

        const keys = Array.from(byMonth.keys()).sort();
        const categories = keys.map(k => {
            const [y, m] = k.split("-").map(Number);
            return `${MONTH_SHORT[m]} ${y}`;
        });

        const series = ESTADO_BUCKET_ORDER.map(bucket => ({
            name: ESTADO_BUCKET_LABELS[bucket],
            type: "line",
            smooth: true,
            stack: undefined as string | undefined,
            areaStyle: { opacity: 0.15 },
            showSymbol: false,
            cursor: "pointer",
            lineStyle: { width: 2, color: ESTADO_BUCKET_COLORS[bucket] },
            itemStyle: { color: ESTADO_BUCKET_COLORS[bucket] },
            data: keys.map(k => byMonth.get(k)![bucket]),
        }));

        return {
            textStyle: { fontFamily: "var(--font-geist-sans), sans-serif" },
            tooltip: {
                trigger: "axis",
                backgroundColor: "#254153",
                borderWidth: 0,
                textStyle: { color: "#fff", fontSize: 12 },
            },
            legend: { top: 0, textStyle: { fontSize: 11, color: "#475569" } },
            grid: { left: 40, right: 16, top: 36, bottom: 28 },
            xAxis: {
                type: "category",
                data: categories,
                axisLabel: { fontSize: 10, color: "#94a3b8", interval: Math.ceil(categories.length / 14) },
                axisLine: { lineStyle: { color: "#e2e8f0" } },
            },
            yAxis: {
                type: "value",
                name: "# Oportunidades",
                nameTextStyle: { fontSize: 10, color: "#94a3b8" },
                axisLabel: { fontSize: 10, color: "#94a3b8" },
                splitLine: { lineStyle: { color: "#f1f5f9" } },
            },
            series,
        };
    }, [filtered]);

    return (
        <div className="flex flex-col gap-6">
            {/* Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Año</label>
                        <SearchableSelect options={yearOptions} value={filters.year} onChange={v => setFilter("year", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mes</label>
                        <SearchableSelect options={monthOptions} value={filters.month} onChange={v => setFilter("month", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Asesor</label>
                        <MultiSelect options={ownerOptions} selected={filters.ownerIds} onChange={v => setFilter("ownerIds", v)} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado</label>
                        <MultiSelect options={ESTADO_OPTIONS} selected={filters.estados} onChange={v => setFilter("estados", v as EstadoBucket[])} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Canal</label>
                        <SearchableSelect options={canalOptions} value={filters.canalId} onChange={v => setFilter("canalId", v)} placeholder="Todos" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">SubClasificación</label>
                        <SearchableSelect options={subclasOptions} value={filters.subclasificacionId} onChange={v => setFilter("subclasificacionId", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Segmentos</label>
                        <SearchableSelect options={segmentoOptions} value={filters.segmentoId} onChange={v => setFilter("segmentoId", v)} placeholder="Todos" />
                    </div>
                    {filters.canalId && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Etapas</label>
                            <MultiSelect options={faseOptions} selected={filters.faseIds} onChange={v => setFilter("faseIds", v)} placeholder="Todas" />
                        </div>
                    )}
                </div>
                {(filters.year || filters.month || filters.ownerIds.length > 0 || filters.estados.length > 0 || filters.canalId || filters.subclasificacionId || filters.segmentoId || filters.faseIds.length > 0) && (
                    <button
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        className="mt-3 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Monto Total" amount={totals.total.amount} count={totals.total.count} icon={Wallet} accent="bg-[#254153]" />
                <KpiCard label="Monto Abierta" amount={totals.open.amount} count={totals.open.count} icon={CircleDot} accent="bg-blue-500" />
                <KpiCard label="Monto Ganado" amount={totals.won.amount} count={totals.won.count} icon={Trophy} accent="bg-emerald-500" />
                <KpiCard label="Monto Perdida" amount={totals.lost.amount} count={totals.lost.count} icon={XCircle} accent="bg-red-500" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <PieChart className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Oportunidades por estado</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 -mt-1 mb-1">Haz clic en una porción para filtrar toda la página por ese estado.</p>
                    <div className="flex-1 min-h-[280px]">
                        <ReactECharts
                            option={pieOption}
                            style={{ height: "100%", width: "100%" }}
                            opts={{ renderer: "svg" }}
                            notMerge={true}
                            onEvents={chartClickEvents}
                        />
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-[#254153]" />
                        <h3 className="font-bold text-slate-800 text-sm">Oportunidades por tiempo</h3>
                    </div>
                    <div className="flex-1 min-h-[280px]">
                        {timeOption.series[0].data.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                No hay oportunidades con fecha de cierre estimada para estos filtros.
                            </div>
                        ) : (
                            <ReactECharts
                                option={timeOption}
                                style={{ height: "100%", width: "100%" }}
                                opts={{ renderer: "svg" }}
                                notMerge={true}
                                onEvents={chartClickEvents}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
