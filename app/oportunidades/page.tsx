"use client";

import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
import { useState, useEffect } from "react";
import { Plus, Search, Filter, Briefcase, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { UserPickerFilter } from "@/components/cuentas/UserPickerFilter";
import { OpportunityFilters } from "@/components/oportunidades/OpportunityFilters";

export default function OpportunitiesPage() {
    const { userRole } = useSyncStore();

    // Server Side Hook
    const {
        data: opportunities,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setUserFilter,
        setAccountOwnerId,
        refresh,
        setChannelFilter,
        setSegmentFilter,
        setPhaseFilter
    } = useOpportunitiesServer({ pageSize: 20 });

    const [selectedAccountOwnerId, setSelectedAccountOwnerId] = useState<string | null>(null);

    const [tab, setTab] = useState<'mine' | 'collab' | 'team'>('mine');
    const [inputValue, setInputValue] = useState("");

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, setSearchTerm]);

    // Handle Tab Change
    const handleTabChange = (newTab: 'mine' | 'collab' | 'team') => {
        setTab(newTab);
        setUserFilter(newTab === 'team' ? 'team' : 'mine');
        // 'collab' not fully implemented in server hook yet, defaults to mine or custom logic
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Oportunidades</h1>

                </div>
                <Link
                    href="/oportunidades/nueva"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 w-full md:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Oportunidad
                </Link>
            </div>

            {/* Tabs & Filters */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-2">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex space-x-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                        <button
                            onClick={() => handleTabChange('mine')}
                            className={cn(
                                "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                tab === 'mine' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            Mis Oportunidades
                        </button>
                        <button
                            onClick={() => handleTabChange('collab')}
                            className={cn(
                                "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                tab === 'collab' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            En las que colaboro
                        </button>

                        {userRole === 'ADMIN' && (
                            <button
                                onClick={() => handleTabChange('team')}
                                className={cn(
                                    "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    tab === 'team' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                                )}
                            >
                                Todas (Equipo)
                            </button>
                        )}
                    </div>

                    {/* Search and User Picker */}
                    <div className="flex gap-2 w-full md:w-auto items-center">
                        <UserPickerFilter
                            selectedUserId={selectedAccountOwnerId}
                            onUserSelect={(userId) => {
                                setSelectedAccountOwnerId(userId);
                                setAccountOwnerId(userId);
                            }}
                        />

                        <div className="relative flex-1 max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Advanced Hierarchical Filters */}
                <div className="pb-2">
                    <OpportunityFilters
                        onFilterChange={({ channelId, segmentId, phaseId }) => {
                            setChannelFilter(channelId);
                            setSegmentFilter(segmentId);
                            setPhaseFilter(phaseId);
                        }}
                    />
                </div>
            </div>

            {/* List */}
            {loading && opportunities.length === 0 ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />
                    ))}
                </div>
            ) : opportunities.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No hay oportunidades aquí</h3>
                    <p className="text-slate-500 mb-4">Crea una nueva oportunidad o ajusta los filtros.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {opportunities.map(opp => {
                        const isOverdue = opp.fecha_cierre_estimada && new Date(opp.fecha_cierre_estimada) < new Date(new Date().setHours(0, 0, 0, 0));
                        return (
                            <Link key={opp.id} href={`/oportunidades/${opp.id}`}>
                                <div className={cn(
                                    "p-4 rounded-xl shadow-sm border transition-all cursor-pointer flex justify-between items-center group",
                                    isOverdue
                                        ? "bg-red-50 border-red-200 hover:border-red-400"
                                        : "bg-white border-slate-200 hover:border-blue-400"
                                )}>
                                    <div>
                                        <h3 className={cn(
                                            "font-bold",
                                            isOverdue ? "text-red-900" : "text-slate-800"
                                        )}>{opp.nombre || "Sin nombre"}</h3>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            <p className="text-sm text-blue-600 font-medium">
                                                {/* Note: Account name comes from join now */}
                                                {opp.account?.nombre || "Sin cuenta"}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {/* Phase mapping would need server-side join or client-side map if Phases are small. 
                                                For now we show ID or TODO: map it 
                                            */}
                                                {opp.fase_data?.nombre || 'Prospecto'} • {opp.estado_data?.nombre || 'Abierta'} • {opp.currency_id || 'COP'} {new Intl.NumberFormat().format(opp.amount || 0)}
                                                {opp.fecha_cierre_estimada && (
                                                    <span className={cn(
                                                        "ml-2 font-normal",
                                                        isOverdue
                                                            ? "text-red-600 font-bold items-center gap-1 inline-flex"
                                                            : "text-slate-400"
                                                    )}>
                                                        • Cierre: {new Date(opp.fecha_cierre_estimada).toLocaleDateString()}
                                                        {isOverdue && (
                                                            <span className="relative flex h-2 w-2 ml-1">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}

                    {hasMore && (
                        <div className="pt-4 flex justify-center">
                            <button
                                onClick={() => loadMore()}
                                disabled={loading}
                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loading ? 'Cargando...' : 'Cargar más resultados'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
