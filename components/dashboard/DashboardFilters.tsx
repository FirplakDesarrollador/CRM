"use client";

import React from "react";
import { useDashboardFilters } from "@/lib/hooks/useDashboardFilters";
import { Filter, X, Search } from "lucide-react";
import { FilterCombobox } from "@/components/dashboard/FilterCombobox";

export interface DashboardFilterState {
    canal_id: string | null;
    advisor_id: string | null;
    subclasificacion_id: number | null;
    nivel_premium: 'ORO' | 'PLATA' | 'BRONCE' | null;
    search_query: string | null;
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
            nivel_premium: null,
            search_query: null
        });
    };

    const hasFilters = filters.canal_id || filters.advisor_id || filters.subclasificacion_id || filters.nivel_premium || filters.search_query;

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
                {/* Search */}
                <div className="relative group w-[200px] shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar cliente, op..."
                        className="w-full h-10 pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#254153]/10 transition-all"
                        value={filters.search_query || ""}
                        onChange={(e) => handleChange("search_query", e.target.value)}
                    />
                </div>

                {/* Canal de Venta */}
                <div className="relative group w-[200px] shrink-0">
                    <FilterCombobox
                        options={options.channels.map(c => ({ value: c.id, label: c.nombre }))}
                        value={filters.canal_id}
                        onChange={(value) => handleChange("canal_id", value as string | null)}
                        placeholder="Canal de Venta"
                    />
                </div>

                {/* Asesor */}
                <div className="relative group w-[200px] shrink-0">
                    <FilterCombobox
                        options={options.advisors.map(a => ({ value: a.id, label: a.full_name }))}
                        value={filters.advisor_id}
                        onChange={(value) => handleChange("advisor_id", value as string | null)}
                        placeholder="Asesor / Vendedor"
                    />
                </div>

                {/* Tipo de Cliente */}
                <div className="relative group w-[200px] shrink-0">
                    <FilterCombobox
                        options={options.clientTypes.map(t => ({ value: t.id, label: t.nombre }))}
                        value={filters.subclasificacion_id}
                        onChange={(value) => handleChange("subclasificacion_id", value ? Number(value) : null)}
                        placeholder="Tipo de Cliente"
                    />
                </div>

                {/* Nivel Premium */}
                <div className="relative group w-[200px] shrink-0">
                    <FilterCombobox
                        options={[
                            { value: 'ORO', label: 'Oro 🏆' },
                            { value: 'PLATA', label: 'Plata 🥈' },
                            { value: 'BRONCE', label: 'Bronce 🥉' }
                        ]}
                        value={filters.nivel_premium}
                        onChange={(value) => handleChange("nivel_premium", value as 'ORO' | 'PLATA' | 'BRONCE' | null)}
                        placeholder="Nivel Premium ✨"
                    />
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
