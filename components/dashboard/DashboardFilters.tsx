"use client";

import React from "react";
import { useDashboardFilters } from "@/lib/hooks/useDashboardFilters";
import { Filter, X, ChevronDown } from "lucide-react";

export interface DashboardFilterState {
    canal_id: string | null;
    advisor_id: string | null;
    subclasificacion_id: number | null;
    nivel_premium: 'ORO' | 'PLATA' | 'BRONCE' | null;
}

interface DashboardFiltersProps {
    filters: DashboardFilterState;
    onFilterChange: (filters: DashboardFilterState) => void;
}

export function DashboardFilters({ filters, onFilterChange }: DashboardFiltersProps) {
    const { options, isLoading } = useDashboardFilters();

    const handleChange = (field: keyof DashboardFilterState, value: any) => {
        onFilterChange({
            ...filters,
            [field]: value === "" ? null : value
        });
    };

    const clearFilters = () => {
        onFilterChange({
            canal_id: null,
            advisor_id: null,
            subclasificacion_id: null,
            nivel_premium: null
        });
    };

    const hasFilters = filters.canal_id || filters.advisor_id || filters.subclasificacion_id || filters.nivel_premium;

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-6 transition-all duration-300">
            {/* Label */}
            <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Filter className="w-4 h-4" />
                </div>
                <span className="text-sm font-black uppercase tracking-widest hidden sm:inline">Filtros</span>
            </div>

            {/* Filters Container */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Canal de Venta */}
                <div className="relative group w-[200px] shrink-0">
                    <select
                        className="w-full h-10 pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#254153]/10 transition-all truncate"
                        value={filters.canal_id || ""}
                        onChange={(e) => handleChange("canal_id", e.target.value)}
                    >
                        <option value="">Canal de Venta</option>
                        {options.channels.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-500 transition-colors" />
                </div>

                {/* Asesor */}
                <div className="relative group w-[200px] shrink-0">
                    <select
                        className="w-full h-10 pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#254153]/10 transition-all truncate"
                        value={filters.advisor_id || ""}
                        onChange={(e) => handleChange("advisor_id", e.target.value)}
                    >
                        <option value="">Asesor / Vendedor</option>
                        {options.advisors.map((a) => (
                            <option key={a.id} value={a.id}>{a.full_name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-500 transition-colors" />
                </div>

                {/* Tipo de Cliente */}
                <div className="relative group w-[200px] shrink-0">
                    <select
                        className="w-full h-10 pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#254153]/10 transition-all truncate"
                        value={filters.subclasificacion_id || ""}
                        onChange={(e) => handleChange("subclasificacion_id", e.target.value ? Number(e.target.value) : "")}
                    >
                        <option value="">Tipo de Cliente</option>
                        {options.clientTypes.map((t) => (
                            <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-500 transition-colors" />
                </div>

                {/* Nivel Premium */}
                <div className="relative group w-[200px] shrink-0">
                    <select
                        className="w-full h-10 pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 appearance-none cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#254153]/10 transition-all truncate"
                        value={filters.nivel_premium || ""}
                        onChange={(e) => handleChange("nivel_premium", e.target.value)}
                    >
                        <option value="">Nivel Premium ✨</option>
                        <option value="ORO">Oro 🏆</option>
                        <option value="PLATA">Plata 🥈</option>
                        <option value="BRONCE">Bronce 🥉</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-500 transition-colors" />
                </div>

                {hasFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all hover:scale-105 active:scale-95 bg-white border border-transparent hover:border-red-100"
                    >
                        <X className="w-3.5 h-3.5" />
                        Limpiar
                    </button>
                )}
            </div>
        </div>
    );
}
