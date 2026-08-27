"use client";

import { Filter, Search, X } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

type DataListToolbarProps = {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    searchTestId?: string;
    quickFilters?: ReactNode;
    sortControl?: ReactNode;
    filters?: ReactNode;
    filtersOpen: boolean;
    onFiltersOpenChange: (open: boolean) => void;
    activeFilterCount?: number;
    onClear?: () => void;
    className?: string;
};

/** Shared list-control pattern for desktop and mobile CRM indexes. */
export function DataListToolbar({
    searchValue,
    onSearchChange,
    searchPlaceholder,
    searchTestId,
    quickFilters,
    sortControl,
    filters,
    filtersOpen,
    onFiltersOpenChange,
    activeFilterCount = 0,
    onClear,
    className,
}: DataListToolbarProps) {
    const hasActiveFilters = activeFilterCount > 0;

    return (
        <section className={cn("rounded-2xl border border-slate-200 bg-white p-3 shadow-sm", className)}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <label className="relative block min-w-0 flex-1 lg:max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        data-testid={searchTestId}
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-100 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                </label>

                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
                    {quickFilters}
                    {sortControl}
                    {filters && (
                        <button
                            type="button"
                            onClick={() => onFiltersOpenChange(!filtersOpen)}
                            className={cn(
                                "relative inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                                filtersOpen || hasActiveFilters
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            )}
                            aria-expanded={filtersOpen}
                        >
                            <Filter className="h-4 w-4" />
                            <span>Filtros</span>
                            {hasActiveFilters && (
                                <span className="min-w-5 rounded-full bg-blue-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    )}
                    {onClear && (searchValue || hasActiveFilters) && (
                        <button type="button" onClick={onClear} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Limpiar búsqueda y filtros" aria-label="Limpiar búsqueda y filtros">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {filters && filtersOpen && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                    {filters}
                </div>
            )}
        </section>
    );
}
