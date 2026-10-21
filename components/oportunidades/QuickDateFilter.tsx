"use client";

import React, { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronDown, Check, X, Sparkles, CalendarRange } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { DATE_FILTER_PRESETS, DateRangePreset } from "@/lib/dateFilterHelpers";

export interface DateFilterChangePayload {
    startDate: string | null;
    endDate: string | null;
    statusFilter?: 'all' | 'open' | 'won' | 'lost';
}

interface DateFilterPanelProps {
    title?: string;
    startDate: string | null;
    endDate: string | null;
    statusFilter?: string;
    onDateChange: (payload: DateFilterChangePayload) => void;
    onClose?: () => void;
}

export function DateFilterPanel({
    title = "Fecha de Creación",
    startDate,
    endDate,
    statusFilter,
    onDateChange,
    onClose
}: DateFilterPanelProps) {
    const todayStr = new Date().toISOString().split("T")[0];

    const [customStart, setCustomStart] = useState<string>(startDate || "");
    const [customEnd, setCustomEnd] = useState<string>(endDate || "");
    const [includeAllStatuses, setIncludeAllStatuses] = useState<boolean>(statusFilter === 'all');

    useEffect(() => {
        setCustomStart(startDate || "");
        setCustomEnd(endDate || "");
        setIncludeAllStatuses(statusFilter === 'all');
    }, [startDate, endDate, statusFilter]);

    const isUpToToday = !startDate && endDate === todayStr;
    const isToday = startDate === todayStr && endDate === todayStr;
    const hasFilter = Boolean(startDate || endDate);

    const handleApplyPreset = (preset: DateRangePreset) => {
        const range = preset.getRange();
        // If up_to_today, by default bring all statuses to bring all historical data as user requested
        const shouldIncludeAll = preset.id === 'up_to_today' ? true : includeAllStatuses;
        onDateChange({
            startDate: range.startDate,
            endDate: range.endDate,
            ...(shouldIncludeAll ? { statusFilter: 'all' as const } : {})
        });
        onClose?.();
    };

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault();
        onDateChange({
            startDate: customStart || null,
            endDate: customEnd || null,
            ...(includeAllStatuses ? { statusFilter: 'all' as const } : {})
        });
        onClose?.();
    };

    const handleClear = () => {
        setCustomStart("");
        setCustomEnd("");
        onDateChange({
            startDate: null,
            endDate: null
        });
        onClose?.();
    };

    return (
        <div className="w-[340px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 text-slate-800 text-left font-sans select-none animate-in fade-in zoom-in-95 duration-150">
            {/* Encabezado */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
                        <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">{title}</div>
                        <div className="text-[11px] text-slate-500 font-medium">Filtrar por rango o historial</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasFilter && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline transition-colors cursor-pointer"
                        >
                            Limpiar
                        </button>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Cerrar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Acción Destacada: Hasta la fecha (Anteriores a hoy) */}
            <div className="mb-3">
                <button
                    type="button"
                    onClick={() => handleApplyPreset(DATE_FILTER_PRESETS[0])}
                    className={cn(
                        "w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 relative cursor-pointer group",
                        isUpToToday
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/25"
                            : "bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-200 hover:border-blue-400 text-slate-900 hover:shadow-sm"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5",
                        isUpToToday ? "bg-white/20 text-white" : "bg-blue-600 text-white group-hover:scale-105 duration-150"
                    )}>
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-1.5">
                            <span className={cn("text-xs font-extrabold tracking-tight", isUpToToday ? "text-white" : "text-blue-950")}>
                                Hasta la fecha (Anteriores a hoy)
                            </span>
                        </div>
                        <p className={cn("text-[11px] mt-0.5 font-medium leading-tight", isUpToToday ? "text-blue-100" : "text-slate-600")}>
                            Trae todo el historial de oportunidades hasta hoy
                        </p>
                    </div>
                    {isUpToToday && (
                        <Check className="w-4 h-4 text-white absolute right-3 top-3.5 shrink-0" />
                    )}
                </button>
            </div>

            {/* Presets rápidos en cuadrícula 2x3 */}
            <div className="mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
                    Opciones Rápidas
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {DATE_FILTER_PRESETS.slice(1).map(preset => {
                        const range = preset.getRange();
                        const isSelected =
                            (preset.id === 'today' && isToday) ||
                            (preset.id === 'all' && !startDate && !endDate) ||
                            (preset.id !== 'today' && preset.id !== 'all' && startDate === range.startDate && endDate === range.endDate);

                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleApplyPreset(preset)}
                                className={cn(
                                    "px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left flex items-center justify-between border cursor-pointer",
                                    isSelected
                                        ? "bg-blue-50 border-blue-400 text-blue-700 shadow-xs"
                                        : "bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/70 text-slate-700 hover:text-slate-900"
                                )}
                            >
                                <span className="truncate">{preset.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Rango personalizado */}
            <form onSubmit={handleApplyCustom} className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Rango Personalizado
                    </p>
                    <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Desde</label>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700 font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hasta</label>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700 font-semibold"
                        />
                    </div>
                </div>

                {/* Traer todos los datos (ganadas, perdidas, abiertas) */}
                <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={includeAllStatuses}
                        onChange={(e) => setIncludeAllStatuses(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="leading-tight">
                        <strong className="text-slate-800 font-semibold">Traer todos los datos</strong> (incluir ganadas y perdidas del histórico)
                    </span>
                </label>

                <div className="pt-1 flex gap-2">
                    <button
                        type="submit"
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                        Aplicar Rango
                    </button>
                    {hasFilter && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Quitar
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

/**
 * Filtro de fecha para la barra de herramientas superior
 */
interface QuickDateFilterProps {
    startDate: string | null;
    endDate: string | null;
    statusFilter?: string;
    onDateChange: (payload: DateFilterChangePayload) => void;
}

export function QuickDateFilter({
    startDate,
    endDate,
    statusFilter,
    onDateChange
}: QuickDateFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    const todayStr = new Date().toISOString().split("T")[0];
    const isUpToToday = !startDate && endDate === todayStr;
    const isToday = startDate === todayStr && endDate === todayStr;
    const hasFilter = Boolean(startDate || endDate);

    let currentLabel = "Filtrar por fecha";
    if (isUpToToday) {
        currentLabel = "Hasta hoy (Todo)";
    } else if (isToday) {
        currentLabel = "Creadas hoy";
    } else if (startDate && endDate) {
        currentLabel = `${startDate} a ${endDate}`;
    } else if (startDate) {
        currentLabel = `Desde ${startDate}`;
    } else if (endDate) {
        currentLabel = `Hasta ${endDate}`;
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDateChange({
            startDate: null,
            endDate: null
        });
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative inline-block text-left">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-200 select-none shadow-xs cursor-pointer",
                    hasFilter
                        ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20 ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                )}
                title="Filtrar oportunidades por fecha"
            >
                <CalendarDays className={cn("w-4 h-4 shrink-0", hasFilter ? "text-white" : "text-blue-600")} />
                <span className="whitespace-nowrap max-w-[170px] truncate">{currentLabel}</span>
                {hasFilter ? (
                    <span
                        role="button"
                        onClick={handleClear}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-blue-700 text-white transition-colors cursor-pointer"
                        title="Quitar filtro de fecha"
                    >
                        <X className="w-3.5 h-3.5" />
                    </span>
                ) : (
                    <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
                )}
            </button>

            {isOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50">
                    <DateFilterPanel
                        title="Fecha de Creación"
                        startDate={startDate}
                        endDate={endDate}
                        statusFilter={statusFilter}
                        onDateChange={onDateChange}
                        onClose={() => setIsOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Popover flotante anclado a la cabecera de la columna CREADA de la tabla
 */
export interface FloatingDateFilterPopoverProps {
    anchor: { top: number; left: number; title?: string } | null;
    startDate: string | null;
    endDate: string | null;
    statusFilter?: string;
    onDateChange: (payload: DateFilterChangePayload) => void;
    onClose: () => void;
}

export function FloatingDateFilterPopover({
    anchor,
    startDate,
    endDate,
    statusFilter,
    onDateChange,
    onClose
}: FloatingDateFilterPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!anchor) return;

        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [anchor, onClose]);

    if (!anchor) return null;

    return (
        <div
            ref={popoverRef}
            style={{
                position: "fixed",
                top: `${anchor.top}px`,
                left: `${anchor.left}px`,
                zIndex: 9999
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <DateFilterPanel
                title={anchor.title || "Fecha de Creación"}
                startDate={startDate}
                endDate={endDate}
                statusFilter={statusFilter}
                onDateChange={onDateChange}
                onClose={onClose}
            />
        </div>
    );
}
