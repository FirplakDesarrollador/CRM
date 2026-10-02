"use client";

import React, { useCallback, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { CalendarCheck2, CheckCircle2, BarChart3, CalendarClock, AlertTriangle, FileWarning } from "lucide-react";
import { useIndicadoresLookups } from "@/lib/hooks/useIndicadoresLookups";
import { useCanalPropioVendedores, TipoCanalVendedor } from "@/lib/hooks/useCanalPropioVendedores";
import { useLiveActivities } from "@/lib/hooks/useLiveActivities";
import { useLiveOpportunities } from "@/lib/hooks/useLiveOpportunities";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, Option } from "@/components/ui/MultiSelect";
import { currentWeekMarkLine, getISOWeek, getWeekKey, withCurrentWeekMarker } from "./weekUtils";
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

interface Filters {
    canalId: string;
    tiposCanal: TipoCanalVendedor[];
    year: string;
    month: string;
    day: string;
    week: string;
    asesorIds: string[]; // also set via chart/table click cross-filter
    clasificacionIds: string[];
    subclasificacionId: string;
}

const EMPTY_FILTERS: Filters = {
    canalId: "",
    tiposCanal: [],
    year: "",
    month: "",
    day: "",
    week: "",
    asesorIds: [],
    clasificacionIds: [],
    subclasificacionId: "",
};
const CANAL_PROPIO_ID = "PROPIO";
const WEEK_OPTIONS = Array.from({ length: 53 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

export function Page4Eventos() {
    const { users, channels, accountsMap, subclasificaciones, activityClassifications } = useIndicadoresLookups();
    const { tipoByVendedor } = useCanalPropioVendedores();
    // Live from Supabase, same rationale as Page 3: the offline cache can be
    // stale for this data even right after a manual sync.
    const { activities } = useLiveActivities();
    const { opportunities } = useLiveOpportunities();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [overdueDetailAsesorId, setOverdueDetailAsesorId] = useState<string | null>(null);

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

    const clasificacionOptions: Option[] = useMemo(
        () =>
            activityClassifications
                .filter(c => !c.is_deleted)
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(c => ({ value: String(c.id), label: c.nombre })),
        [activityClassifications]
    );

    const clasificacionMap = useMemo(() => {
        const map = new Map<number, string>();
        activityClassifications.forEach(c => map.set(c.id, c.nombre));
        return map;
    }, [activityClassifications]);

    const subclasOptions: SearchableSelectOption[] = useMemo(
        () =>
            subclasificaciones
                .filter(s => !filters.canalId || s.canal_id === filters.canalId)
                .map(s => ({ value: String(s.id), label: s.nombre })),
        [subclasificaciones, filters.canalId]
    );

    // Activities only link to an opportunity sometimes; when account_id is
    // empty, resolve the account through the linked opportunity (same
    // pattern as app/actividades/page.tsx and Page2Clasificaciones).
    const oppAccountMap = useMemo(() => {
        const map = new Map<string, string>();
        (opportunities || []).forEach(o => {
            if (o.account_id) map.set(o.id, o.account_id);
        });
        return map;
    }, [opportunities]);

    const resolveAccount = useCallback(
        (activity: { account_id?: string | null; opportunity_id?: string | null }) => {
            const accountId = activity.account_id || (activity.opportunity_id ? oppAccountMap.get(activity.opportunity_id) : undefined);
            return accountId ? accountsMap.get(accountId) : undefined;
        },
        [accountsMap, oppAccountMap]
    );

    const yearOptions: SearchableSelectOption[] = useMemo(() => {
        const years = new Set<number>();
        (activities || []).forEach(a => {
            if (!a.fecha_inicio) return;
            const year = new Date(a.fecha_inicio).getFullYear();
            if (isPlausibleYear(year)) years.add(year);
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

    // Actividades (Eventos + Tareas) matching Canal, Tipo Canal (Canal Propio
    // only), SubClasificación, Clasificación, Año/Mes/Día and the Asesor
    // filter/cross-filter.
    const eventos = useMemo(() => {
        const yearNum = filters.year ? Number(filters.year) : null;
        const monthNum = filters.month !== "" ? Number(filters.month) : null;
        const dayNum = filters.day ? Number(filters.day) : null;
        const weekNum = filters.week ? Number(filters.week) : null;
        const tipoSet = isCanalPropio && filters.tiposCanal.length > 0 ? new Set(filters.tiposCanal) : null;
        const asesorSet = filters.asesorIds.length > 0 ? new Set(filters.asesorIds) : null;
        const clasifSet = filters.clasificacionIds.length > 0 ? new Set(filters.clasificacionIds.map(Number)) : null;
        const subclasId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        return (activities || []).filter(a => {
            if (a.is_deleted) return false;
            if (asesorSet && (!a.user_id || !asesorSet.has(a.user_id))) return false;
            if (clasifSet && (a.clasificacion_id == null || !clasifSet.has(a.clasificacion_id))) return false;
            const acc = filters.canalId || subclasId ? resolveAccount(a) : undefined;
            if (filters.canalId && acc?.canal_id !== filters.canalId) return false;
            if (subclasId && acc?.subclasificacion_id !== subclasId) return false;
            if (tipoSet) {
                const tipo = a.user_id ? tipoByVendedor.get(a.user_id) : undefined;
                if (!tipo || !tipoSet.has(tipo)) return false;
            }
            if (yearNum != null || monthNum != null || dayNum != null || weekNum != null) {
                if (!a.fecha_inicio) return false;
                const d = new Date(a.fecha_inicio);
                if (yearNum != null && d.getFullYear() !== yearNum) return false;
                if (monthNum != null && d.getMonth() !== monthNum) return false;
                if (dayNum != null && d.getDate() !== dayNum) return false;
                if (weekNum != null && getISOWeek(d) !== weekNum) return false;
            }
            return true;
        });
    }, [activities, filters, isCanalPropio, resolveAccount, tipoByVendedor]);

    const completados = useMemo(() => eventos.filter(a => a.is_completed), [eventos]);

    // Same "atrasada" definition used across the app (app/actividades/page.tsx):
    // not completed and its scheduled day is strictly before today.
    const isOverdueEvent = (a: { fecha_inicio: string | null; is_completed: boolean | null }) => {
        if (a.is_completed || !a.fecha_inicio) return false;
        return new Date(a.fecha_inicio).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
    };
    const atrasados = useMemo(() => eventos.filter(isOverdueEvent), [eventos]);

    const overdueDetailRows = useMemo(() => {
        if (!overdueDetailAsesorId) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return atrasados
            .filter(a => a.user_id === overdueDetailAsesorId)
            .map(a => {
                const fecha = a.fecha_inicio ? new Date(a.fecha_inicio) : null;
                const diasAtraso = fecha ? Math.round((today.getTime() - new Date(fecha).setHours(0, 0, 0, 0)) / 86400000) : null;
                return {
                    id: a.id,
                    asunto: a.asunto?.trim() || "Sin asunto",
                    tipo: a.tipo_actividad === "EVENTO" ? "Evento" : "Tarea",
                    clasificacion: a.clasificacion_id != null ? clasificacionMap.get(a.clasificacion_id) || "-" : "-",
                    cuenta: resolveAccount(a)?.nombre || "Sin cuenta",
                    fechaLabel: fecha ? fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "-",
                    diasAtraso,
                };
            })
            .sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0));
    }, [atrasados, overdueDetailAsesorId, clasificacionMap, resolveAccount]);

    const overdueDetailAsesorName = overdueDetailAsesorId ? userNameMap.get(overdueDetailAsesorId) || "Sin asesor" : null;

    // "Programados" = pendientes por hacer (atrasadas + futuras), no el total
    // historico de todo lo que se ha programado alguna vez. Mismo criterio
    // que pendingTotal en lib/opportunityActivities.ts.
    const pendientes = useMemo(() => eventos.filter(a => !a.is_completed), [eventos]);

    // Oportunidades en el mismo alcance de Canal/Tipo Canal/SubClasificación/
    // Asesor, pero sin el filtro de fecha de las actividades — "sin actividad"
    // es un hecho de la oportunidad, no algo acotado a un rango de tiempo.
    const scopedOpportunitiesForActivity = useMemo(() => {
        const tipoSet = isCanalPropio && filters.tiposCanal.length > 0 ? new Set(filters.tiposCanal) : null;
        const asesorSet = filters.asesorIds.length > 0 ? new Set(filters.asesorIds) : null;
        const subclasId = filters.subclasificacionId ? Number(filters.subclasificacionId) : null;
        return (opportunities || []).filter(o => {
            if (o.is_deleted) return false;
            if (asesorSet && (!o.owner_user_id || !asesorSet.has(o.owner_user_id))) return false;
            const acc = o.account_id ? accountsMap.get(o.account_id) : undefined;
            if (filters.canalId && acc?.canal_id !== filters.canalId) return false;
            if (subclasId && acc?.subclasificacion_id !== subclasId) return false;
            if (tipoSet) {
                const tipo = o.owner_user_id ? tipoByVendedor.get(o.owner_user_id) : undefined;
                if (!tipo || !tipoSet.has(tipo)) return false;
            }
            return true;
        });
    }, [opportunities, filters.canalId, filters.subclasificacionId, filters.asesorIds, filters.tiposCanal, isCanalPropio, accountsMap, tipoByVendedor]);

    // Mismo criterio que computeOpportunityActivitySummary (lib/opportunityActivities.ts):
    // una oportunidad "tiene actividad" si existe al menos una actividad no
    // eliminada ligada a ella, sin importar su tipo o fecha.
    const activityCountByOpportunity = useMemo(() => {
        const map = new Map<string, number>();
        (activities || []).forEach(a => {
            if (a.is_deleted || !a.opportunity_id) return;
            map.set(a.opportunity_id, (map.get(a.opportunity_id) || 0) + 1);
        });
        return map;
    }, [activities]);

    const oportunidadesSinActividad = useMemo(
        () => scopedOpportunitiesForActivity.filter(o => !activityCountByOpportunity.has(o.id)),
        [scopedOpportunitiesForActivity, activityCountByOpportunity]
    );

    const toggleAsesorFilter = (asesorId: string) => {
        setFilters(prev => {
            const isOnlySelected = prev.asesorIds.length === 1 && prev.asesorIds[0] === asesorId;
            return { ...prev, asesorIds: isOnlySelected ? [] : [asesorId] };
        });
    };

    // --- Table: Asesor | Completadas | Pendientes | Atrasadas ----------------
    const advisorRows = useMemo(() => {
        const map = new Map<string, { asesor: string; programados: number; completados: number; atrasados: number; sinActividad: number }>();
        const getOrCreate = (id: string) => {
            let entry = map.get(id);
            if (!entry) {
                entry = { asesor: userNameMap.get(id) || "Sin asesor", programados: 0, completados: 0, atrasados: 0, sinActividad: 0 };
                map.set(id, entry);
            }
            return entry;
        };
        eventos.forEach(a => {
            const entry = getOrCreate(a.user_id!);
            if (a.is_completed) {
                entry.completados += 1;
            } else {
                entry.programados += 1;
                if (isOverdueEvent(a)) entry.atrasados += 1;
            }
        });
        // Oportunidades sin actividad, agrupadas por el asesor dueño de la
        // oportunidad (no necesariamente el mismo que registra la actividad).
        scopedOpportunitiesForActivity.forEach(o => {
            if (!o.owner_user_id || activityCountByOpportunity.has(o.id)) return;
            getOrCreate(o.owner_user_id).sinActividad += 1;
        });
        return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
    }, [eventos, userNameMap, scopedOpportunitiesForActivity, activityCountByOpportunity]);

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

    const handleAdvisorBarClick = (params: EChartsCallbackParams) => {
        const id = params?.data?.id;
        if (id != null) toggleAsesorFilter(String(id));
    };

    // --- Bar chart: eventos completados y programados por semana -------------
    const weeklyOption = useMemo(() => {
        const programadosByWeek = new Map<string, number>();
        const completadosByWeek = new Map<string, number>();
        const atrasadosByWeek = new Map<string, number>();
        const weekLabel = new Map<string, number>();

        eventos.forEach(a => {
            if (!a.fecha_inicio) return;
            const { key, week } = getWeekKey(new Date(a.fecha_inicio));
            weekLabel.set(key, week);
            if (a.is_completed) {
                completadosByWeek.set(key, (completadosByWeek.get(key) || 0) + 1);
            } else {
                // "Programadas" = pendientes por hacer (atrasadas + futuras).
                programadosByWeek.set(key, (programadosByWeek.get(key) || 0) + 1);
                if (isOverdueEvent(a)) atrasadosByWeek.set(key, (atrasadosByWeek.get(key) || 0) + 1);
            }
        });

        const { weekKeys, currentIndex } = withCurrentWeekMarker(weekLabel);
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
                {
                    name: "Eventos Atrasados",
                    type: "bar",
                    barMaxWidth: 14,
                    itemStyle: { color: "#ef4444", borderRadius: [2, 2, 0, 0] },
                    data: weekKeys.map(k => atrasadosByWeek.get(k) || 0),
                    markLine: currentWeekMarkLine(currentIndex),
                },
            ],
        };
    }, [eventos]);

    const hasActiveFilters =
        filters.canalId || filters.tiposCanal.length > 0 || filters.year || filters.month || filters.day || filters.week ||
        filters.asesorIds.length > 0 || filters.clasificacionIds.length > 0 || filters.subclasificacionId;

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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Clasificación</label>
                        <MultiSelect options={clasificacionOptions} selected={filters.clasificacionIds} onChange={v => setFilter("clasificacionIds", v)} placeholder="Todas" />
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Día</label>
                        <SearchableSelect options={dayOptions} value={filters.day} onChange={v => setFilter("day", v)} placeholder="Todas" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Semana</label>
                        <SearchableSelect options={WEEK_OPTIONS} value={filters.week} onChange={v => setFilter("week", v)} placeholder="Todas" />
                    </div>
                </div>
                {hasActiveFilters && (
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-3 text-xs font-bold text-slate-400 hover:text-[#254153] transition-colors underline">
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#254153] flex items-center justify-center text-white shrink-0">
                        <CalendarClock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{pendientes.length}</p>
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
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{atrasados.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eventos Atrasados</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0">
                        <FileWarning className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{oportunidadesSinActividad.length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Oportunidades sin actividad</p>
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
                                    <th className="px-3 py-2 text-right">Atrasados</th>
                                    <th className="px-3 py-2 text-right">Sin actividad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {advisorRowsAlpha.map(row => (
                                    <tr
                                        key={row.id}
                                        onClick={() => toggleAsesorFilter(row.id)}
                                        className={`cursor-pointer hover:bg-slate-50/60 transition-colors ${filters.asesorIds.includes(row.id) ? "bg-blue-50/60" : ""}`}
                                    >
                                        <td className="px-3 py-2 text-blue-700 font-medium">{row.asesor}</td>
                                        <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{row.completados}</td>
                                        <td className="px-3 py-2 text-right text-slate-800 font-semibold tabular-nums">{row.programados}</td>
                                        <td
                                            className={`px-3 py-2 text-right tabular-nums ${row.atrasados > 0 ? "text-red-600 font-semibold underline decoration-dotted cursor-pointer hover:text-red-800" : "text-slate-400"}`}
                                            onClick={e => {
                                                if (row.atrasados === 0) return;
                                                e.stopPropagation();
                                                setOverdueDetailAsesorId(row.id);
                                            }}
                                            title={row.atrasados > 0 ? "Ver actividades atrasadas" : undefined}
                                        >
                                            {row.atrasados}
                                        </td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${row.sinActividad > 0 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>{row.sinActividad}</td>
                                    </tr>
                                ))}
                                {advisorRowsAlpha.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-slate-400">Sin datos para estos filtros.</td>
                                    </tr>
                                )}
                            </tbody>
                            {advisorRowsAlpha.length > 0 && (
                                <tfoot className="sticky bottom-0 bg-white border-t border-slate-100">
                                    <tr className="font-black text-slate-900">
                                        <td className="px-3 py-2">Total</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{completados.length}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{pendientes.length}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-red-600">{atrasados.length}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-amber-600">{oportunidadesSinActividad.length}</td>
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

            {/* Overdue detail modal */}
            {overdueDetailAsesorId && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
                    onClick={() => setOverdueDetailAsesorId(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="font-bold text-slate-900">Atrasadas de {overdueDetailAsesorName}</h3>
                                <p className="text-xs text-slate-400">{overdueDetailRows.length} actividad{overdueDetailRows.length === 1 ? "" : "es"} atrasada{overdueDetailRows.length === 1 ? "" : "s"}</p>
                            </div>
                            <button
                                onClick={() => setOverdueDetailAsesorId(null)}
                                className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2"
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>
                        <div className="overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 z-10">
                                    <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="px-4 py-2">Asunto</th>
                                        <th className="px-4 py-2">Cuenta</th>
                                        <th className="px-4 py-2">Clasificación</th>
                                        <th className="px-4 py-2">Fecha</th>
                                        <th className="px-4 py-2 text-right">Días atraso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {overdueDetailRows.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2 text-slate-800 font-medium">{row.asunto}</td>
                                            <td className="px-4 py-2 text-slate-600">{row.cuenta}</td>
                                            <td className="px-4 py-2 text-slate-600">{row.clasificacion}</td>
                                            <td className="px-4 py-2 text-slate-600">{row.fechaLabel}</td>
                                            <td className="px-4 py-2 text-right text-red-600 font-semibold tabular-nums">{row.diasAtraso ?? "-"}</td>
                                        </tr>
                                    ))}
                                    {overdueDetailRows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin actividades atrasadas.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
