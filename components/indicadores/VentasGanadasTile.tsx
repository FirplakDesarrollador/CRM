"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { DollarSign, Calendar as CalendarIcon, TrendingUp, Filter, Check, ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/utils";


export const VentasGanadasTile = () => {
    // 1. Get current date
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-11

    const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
    const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    // 2. Fetch opportunities and phases
    const { opportunities } = useOpportunities();
    const phases = useLiveQuery(() => db.phases.toArray());

    const channels = useMemo(() => {
        if (!phases) return [];
        return Array.from(new Set(phases.map(p => p.canal_id))).filter(Boolean);
    }, [phases]);

    const phasesForSelectedChannel = useMemo(() => {
        if (!phases || selectedChannel === "ALL") return [];
        return phases.filter(p => p.canal_id === selectedChannel).sort((a, b) => a.orden - b.orden);
    }, [phases, selectedChannel]);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 3. Process opportunities
    const filteredSum = useMemo(() => {
        if (!opportunities) return 0;

        return opportunities
            .filter(opp => {
                // fecha_cierre_estimada must be in the selected month/year
                if (!opp.fecha_cierre_estimada) return false;

                const fechaCierre = new Date(opp.fecha_cierre_estimada);
                // Adjust for timezone differences if necessary
                const isCorrectDate = fechaCierre.getFullYear() === selectedYear &&
                                      fechaCierre.getMonth() === selectedMonth;
                if (!isCorrectDate) return false;

                if (selectedChannel === "ALL") {
                    // Default logic: sum all won opportunities
                    return opp.estado_id === 2;
                } else {
                    // Filter by specific channel's phases
                    if (selectedPhases.length > 0) {
                        return selectedPhases.includes(opp.fase_id);
                    } else if (phasesForSelectedChannel.length > 0) {
                        // if channel selected but no specific phases, include all phases of that channel
                        const channelPhaseIds = phasesForSelectedChannel.map(p => p.id);
                        return channelPhaseIds.includes(opp.fase_id);
                    }
                    return false; // Channel has no phases or mismatch
                }
            })
            .reduce((sum, opp) => sum + (Number(opp.amount || opp.valor) || 0), 0);

    }, [opportunities, selectedYear, selectedMonth, selectedChannel, selectedPhases, phasesForSelectedChannel]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
    };

    // Helper to generate last 12 months for selector
    const monthOptions = useMemo(() => {
        const options = [];
        const formatter = new Intl.DateTimeFormat('es-CO', { month: 'long' });
        
        for (let i = 0; i < 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            options.push({
                year: d.getFullYear(),
                month: d.getMonth(),
                label: `${formatter.format(d)} ${d.getFullYear()}`
            });
        }
        return options;
    }, [today.getFullYear(), today.getMonth()]);

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [yearStr, monthStr] = e.target.value.split('-');
        setSelectedYear(parseInt(yearStr, 10));
        setSelectedMonth(parseInt(monthStr, 10));
    };

    const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedChannel(e.target.value);
        setSelectedPhases([]); // Reset selected phases when channel changes
    };

    const togglePhase = (phaseId: number) => {
        setSelectedPhases(prev => 
            prev.includes(phaseId) ? prev.filter(id => id !== phaseId) : [...prev, phaseId]
        );
    };

    const selectAllPhases = () => {
        setSelectedPhases(phasesForSelectedChannel.map(p => p.id));
    };

    const clearPhaseSelection = () => {
        setSelectedPhases([]);
    };

    return (
        <div className={cn(
            "bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 hover:border-[#254153]/30 transition-all flex flex-col relative group min-h-[180px]",
            isFilterOpen ? "z-50" : "z-10"
        )}>
            {/* Background decoration with its own overflow control */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <TrendingUp className="w-32 h-32 text-[#254153]" />
                </div>
            </div>

            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-[#254153] to-[#1a2f3d] flex items-center justify-center shadow-lg text-white shrink-0">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">
                            {selectedChannel === "ALL" ? "Ventas ganadas mes" : "Oportunidades por fase"}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium tracking-wide">
                            {selectedChannel === "ALL" 
                                ? "Sumatoria de oportunidades ganadas" 
                                : `Canal: ${selectedChannel} ${selectedPhases.length > 0 ? `(${selectedPhases.length} fases)` : '(Todas las fases)'}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                    {/* Date Selector */}
                    <div className="relative bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-sm">
                        <CalendarIcon className="w-4 h-4 text-slate-500" />
                        <select
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none pr-4"
                            value={`${selectedYear}-${selectedMonth}`}
                            onChange={handleMonthChange}
                        >
                            {monthOptions.map(opt => (
                                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`} className="capitalize">
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Popover Container */}
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border transition-all shadow-sm",
                                selectedChannel !== "ALL" 
                                    ? "bg-[#254153] text-white border-[#254153] hover:bg-[#1a2f3d]" 
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isFilterOpen && "rotate-180")} />
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-4 z-9999 animate-in fade-in zoom-in duration-200 origin-top-right">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-slate-800 text-sm">Filtro por Canal y Fases</h4>
                                    {selectedPhases.length > 0 && (
                                        <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                            {selectedPhases.length} seleccionadas
                                        </span>
                                    )}
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Channel Selector */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">
                                            Seleccionar Canal
                                        </label>
                                        <div className="relative">
                                            <select
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                                                value={selectedChannel}
                                                onChange={handleChannelChange}
                                            >
                                                <option value="ALL">Todos los Canales (Solo Ganadas)</option>
                                                {channels.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Phases Multi-Select */}
                                    {selectedChannel !== "ALL" && (
                                        <div className="border-t border-slate-100 pt-3">
                                            <div className="flex justify-between items-center mb-2 px-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                    Escoger Fases
                                                </label>
                                                <div className="flex gap-2">
                                                    <button onClick={selectAllPhases} className="text-[10px] text-blue-600 font-bold hover:text-blue-800 transition-colors">
                                                        Todas
                                                    </button>
                                                    <div className="w-px h-3 bg-slate-200" />
                                                    <button onClick={clearPhaseSelection} className="text-[10px] text-slate-400 font-bold hover:text-slate-600 transition-colors">
                                                        Limpiar
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                                <style jsx>{`
                                                    .scrollbar-thin::-webkit-scrollbar {
                                                        width: 5px;
                                                    }
                                                    .scrollbar-thin::-webkit-scrollbar-track {
                                                        background: transparent;
                                                    }
                                                    .scrollbar-thin::-webkit-scrollbar-thumb {
                                                        background: #e2e8f0;
                                                        border-radius: 10px;
                                                    }
                                                    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                                                        background: #cbd5e1;
                                                    }
                                                `}</style>
                                                {phasesForSelectedChannel.map(phase => {
                                                    const isSelected = selectedPhases.includes(phase.id);
                                                    return (
                                                        <label 
                                                            key={phase.id} 
                                                            className={cn(
                                                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border group/item mb-1",
                                                                isSelected 
                                                                    ? "bg-blue-50/60 border-blue-200 shadow-sm" 
                                                                    : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                                                            )}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only" 
                                                                checked={isSelected}
                                                                onChange={() => togglePhase(phase.id)}
                                                            />
                                                            <div className={cn(
                                                                "w-5 h-5 flex items-center justify-center rounded-lg border shrink-0 transition-all",
                                                                isSelected 
                                                                    ? "bg-[#254153] border-[#254153] shadow-md scale-105" 
                                                                    : "border-slate-300 bg-white group-hover/item:border-slate-400"
                                                            )}>
                                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm font-semibold transition-colors",
                                                                isSelected ? "text-[#254153]" : "text-slate-600 group-hover/item:text-slate-900"
                                                            )}>
                                                                {phase.nombre}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                                {phasesForSelectedChannel.length === 0 && (
                                                    <p className="text-xs text-slate-400 p-4 text-center italic bg-slate-50 rounded-xl">
                                                        No hay fases configuradas para este canal.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            <div className="flex-1 flex flex-col justify-end relative z-10">
                <div className="flex items-end gap-2">
                    <span className="text-4xl md:text-5xl font-black text-[#254153] tracking-tight">
                        {formatCurrency(filteredSum)}

                    </span>
                    <span className="text-sm font-bold text-slate-400 mb-2 uppercase">COP</span>
                </div>
            </div>

            {/* Bottom decoration line */}
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-linear-to-r from-[#254153] to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
};
