"use client";

import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, Filter, Briefcase, User, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { UserPickerFilter } from "@/components/cuentas/UserPickerFilter";
import { OpportunityFilters } from "@/components/oportunidades/OpportunityFilters";
import { formatColombiaDate, isDateOverdue } from "@/lib/date-utils";

function OpportunitiesContent() {
    const { role: userRole } = useCurrentUser();
    const searchParams = useSearchParams();
    const router = useRouter();

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
        setSubclassificationFilter,
        setSegmentFilter,
        setPhaseFilter,
        setStatusFilter,
        setStartDate,
        setEndDate,
        setStartClosingDate,
        setEndClosingDate,
        setSortField,
        setSortAsc,
        sortField,
        sortAsc
    } = useOpportunitiesServer({ pageSize: 20 });

    const [inputValue, setInputValue] = useState(() => {
        const fromUrl = searchParams.get('search');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('search') || "";
        }
        return "";
    });
    const [selectedAccountOwnerId, setSelectedAccountOwnerId] = useState<string | null>(() => {
        const fromUrl = searchParams.get('owner');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('owner') || null;
        }
        return null;
    });

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
        return sortAsc 
            ? <ChevronUp className="w-3 h-3 ml-1 text-blue-600" /> 
            : <ChevronDown className="w-3 h-3 ml-1 text-blue-600" />;
    };
    const [tab, setTab] = useState<'mine' | 'collab' | 'team'>(() => {
        const fromUrl = searchParams.get('tab');
        if (fromUrl) return (fromUrl as any);
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return (new URLSearchParams(saved).get('tab') as any) || 'mine';
        }
        return 'mine';
    });
    const [selectedChannel, setSelectedChannel] = useState<string | null>(() => {
        const fromUrl = searchParams.get('channel');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('channel') || null;
        }
        return null;
    });
    const [statusFilter, setStatusFilterState] = useState<'all' | 'open' | 'won' | 'lost'>(() => {
        const fromUrl = searchParams.get('status');
        if (fromUrl) return (fromUrl as any);
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return (new URLSearchParams(saved).get('status') as any) || 'open';
        }
        return 'open';
    });

    const [startDate, setStartDateState] = useState<string | null>(() => {
        const fromUrl = searchParams.get('start');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('start') || null;
        }
        return null;
    });

    const [endDate, setEndDateState] = useState<string | null>(() => {
        const fromUrl = searchParams.get('end');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('end') || null;
        }
        return null;
    });

    const [startClosingDate, setStartClosingDateState] = useState<string | null>(() => {
        const fromUrl = searchParams.get('startClose');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('startClose') || null;
        }
        return null;
    });

    const [endClosingDate, setEndClosingDateState] = useState<string | null>(() => {
        const fromUrl = searchParams.get('endClose');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) return new URLSearchParams(saved).get('endClose') || null;
        }
        return null;
    });

    // On mount: apply initial filter values from URL to the server hook
    // This is critical for the "back button" scenario where URL has params but hook starts fresh
    useEffect(() => {
        const initialTab = (searchParams.get('tab') as any) || 'mine';
        const initialSearch = searchParams.get('search') || '';
        const initialOwner = searchParams.get('owner') || null;

        // Apply tab, search, owner to hook (channel/status/dates are handled by OpportunityFilters on init)
        if (initialSearch) setSearchTerm(initialSearch);
        if (initialOwner) setAccountOwnerId(initialOwner);
        setUserFilter(initialTab);
        
        // Initial dates for the hook
        const start = searchParams.get('start') || startDate;
        const end = searchParams.get('end') || endDate;
        const startClose = searchParams.get('startClose') || startClosingDate;
        const endClose = searchParams.get('endClose') || endClosingDate;
        
        if (start) setStartDate(start);
        if (end) setEndDate(end);
        if (startClose) setStartClosingDate(startClose);
        if (endClose) setEndClosingDate(endClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    // Restore state from sessionStorage if navigating from sidebar (empty query)
    useEffect(() => {
        if (typeof window !== 'undefined' && searchParams.toString() === '') {
            const savedState = sessionStorage.getItem('crm_oportunidades_state');
            if (savedState) {
                const savedParams = new URLSearchParams(savedState);
                const savedId = savedParams.get('id');
                if (savedId) {
                    router.replace(`/oportunidades/${savedId}`, { scroll: false });
                } else {
                    router.replace(`/oportunidades?${savedState}`, { scroll: false });
                }
            }
        }
    }, [searchParams, router]);

    // Sync Search Term to hook (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue, setSearchTerm]);

    // Sync all filters to URL and SessionStorage (immediate for non-search filters)
    useEffect(() => {
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        
        if (inputValue) params.set('search', inputValue);
        else params.delete('search');
        
        if (tab && tab !== 'mine') params.set('tab', tab);
        else params.delete('tab');
        
        if (selectedAccountOwnerId) params.set('owner', selectedAccountOwnerId);
        else params.delete('owner');

        if (selectedChannel) params.set('channel', selectedChannel);
        else params.delete('channel');

        if (statusFilter && statusFilter !== 'open') params.set('status', statusFilter);
        else params.delete('status');
        
        if (startDate) params.set('start', startDate);
        else params.delete('start');
        
        if (endDate) params.set('end', endDate);
        else params.delete('end');
        
        if (startClosingDate) params.set('startClose', startClosingDate);
        else params.delete('startClose');
        
        if (endClosingDate) params.set('endClose', endClosingDate);
        else params.delete('endClose');
        
        const queryString = params.toString();
        if (queryString === searchParams.toString()) return;
        
        // Save to sessionStorage for cross-module persistence
        if (queryString) {
            sessionStorage.setItem('crm_oportunidades_state', queryString);
        } else if (searchParams.toString() !== '') {
            sessionStorage.removeItem('crm_oportunidades_state');
        }
        
        const query = queryString ? `?${queryString}` : window.location.pathname;
        router.replace(query.startsWith('?') ? `${window.location.pathname}${query}` : query, { scroll: false });
    }, [tab, selectedAccountOwnerId, selectedChannel, statusFilter, startDate, endDate, startClosingDate, endClosingDate, searchParams, router]); // Notice inputValue is NOT in deps here to avoid URL churn during typing


    const handleFilterChange = useCallback(({ 
        channelId, subclassificationId, segmentId, phaseId, statusFilter: newStatus,
        startDate: sD, endDate: eD, startClosingDate: sCD, endClosingDate: eCD
    }: any) => {
        setSelectedChannel(channelId);
        setStatusFilterState(newStatus);
        setStartDateState(sD);
        setEndDateState(eD);
        setStartClosingDateState(sCD);
        setEndClosingDateState(eCD);
        
        setChannelFilter(channelId);
        setSubclassificationFilter(subclassificationId);
        setSegmentFilter(segmentId);
        setPhaseFilter(phaseId);
        setStatusFilter(newStatus);
        setStartDate(sD);
        setEndDate(eD);
        setStartClosingDate(sCD);
        setEndClosingDate(eCD);
    }, [setChannelFilter, setSubclassificationFilter, setSegmentFilter, setPhaseFilter, setStatusFilter, setStartDate, setEndDate, setStartClosingDate, setEndClosingDate]);

    // PERF FIX: Stable callback references
    const handleTabChange = useCallback((newTab: 'mine' | 'collab' | 'team') => {
        setTab(newTab);
        setUserFilter(newTab);
    }, [setUserFilter]);

    const handleUserSelect = useCallback((userId: string | null) => {
        setSelectedAccountOwnerId(userId);
        setAccountOwnerId(userId);
    }, [setAccountOwnerId]);

    return (
        <div data-testid="opportunities-page" className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Oportunidades</h1>

                </div>
                <Link
                    href="/oportunidades/nueva"
                    data-testid="opportunities-create-button"
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
                            data-testid="opportunities-tab-mine"
                            onClick={() => handleTabChange('mine')}
                            className={cn(
                                "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                tab === 'mine' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            Mis Oportunidades
                        </button>
                        <button
                            data-testid="opportunities-tab-collab"
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
                                data-testid="opportunities-tab-team"
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
                            onUserSelect={handleUserSelect}
                        />

                        <div className="relative flex-1 max-w-md w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                data-testid="opportunities-search"
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
                        onFilterChange={handleFilterChange}
                        initialChannelId={selectedChannel}
                        initialStatusFilter={statusFilter}
                        initialDates={{
                            startDate,
                            endDate,
                            startClosingDate,
                            endClosingDate
                        }}
                    />
                </div>
            </div>

            {/* List */}
            {loading && opportunities.length === 0 ? (
                <div data-testid="opportunities-loading" className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />
                    ))}
                </div>
            ) : opportunities.length === 0 ? (
                <div data-testid="opportunities-empty-state" className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No hay oportunidades aquí</h3>
                    <p className="text-slate-500 mb-4">Crea una nueva oportunidad o ajusta los filtros.</p>
                </div>
            ) : (
                <div data-testid="opportunities-list" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th 
                                        onClick={() => handleSort('account_nombre')}
                                        className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center">Cuenta <SortIcon field="account_nombre" /></div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('nombre')}
                                        className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center">Nombre <SortIcon field="nombre" /></div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('created_at')}
                                        className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer group hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-center">Creada <SortIcon field="created_at" /></div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('amount')}
                                        className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right cursor-pointer group hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-end">Valor <SortIcon field="amount" /></div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('fecha_cierre_estimada')}
                                        className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer group hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-center">Cierre <SortIcon field="fecha_cierre_estimada" /></div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('vendedor_nombre')}
                                        className="px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100/50 transition-colors"
                                    >
                                        <div className="flex items-center">Vendedor <SortIcon field="vendedor_nombre" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {opportunities.map(opp => {
                                    const isOverdue = isDateOverdue(opp.fecha_cierre_estimada);
                                    return (
                                        <tr 
                                            key={opp.id} 
                                            onClick={() => {
                                                const params = new URLSearchParams(Array.from(searchParams.entries()));
                                                params.set('id', opp.id);
                                                sessionStorage.setItem('crm_oportunidades_state', params.toString());
                                                router.push(`/oportunidades/${opp.id}`);
                                            }}
                                            className={cn(
                                                "group cursor-pointer transition-colors",
                                                isOverdue ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-slate-50"
                                            )}
                                            data-testid={`opportunities-row-${opp.id}`}
                                        >
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs font-medium text-blue-600 truncate block max-w-[130px]" title={opp.account?.nombre || ""}>
                                                    {opp.account?.nombre || "Sin cuenta"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={cn(
                                                        "text-xs font-bold truncate block max-w-[160px]",
                                                        isOverdue ? "text-red-900" : "text-slate-900"
                                                    )} title={opp.nombre || ""}>
                                                        {opp.nombre || "Sin nombre"}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] px-1 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase whitespace-nowrap">
                                                            {opp.fase_data?.nombre || 'Pros.'}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[9px] px-1 py-0.5 rounded-full font-bold uppercase whitespace-nowrap",
                                                            (opp.estado_data?.nombre?.toLowerCase().includes('ganada') || opp.estado_data?.nombre?.toLowerCase().includes('ganado')) ? "bg-emerald-100 text-emerald-700" :
                                                            (opp.estado_data?.nombre?.toLowerCase().includes('perdida') || opp.estado_data?.nombre?.toLowerCase().includes('perdido') || opp.estado_data?.nombre?.toLowerCase().includes('cancelada')) ? "bg-red-100 text-red-700" :
                                                            "bg-blue-100 text-blue-700"
                                                        )}>
                                                            {opp.estado_data?.nombre || 'Abierta'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                                    {opp.created_at ? new Date(opp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: opp.currency_id === '2' ? 'USD' : 'COP', maximumFractionDigits: 0 }).format(opp.amount || 0)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded flex-col",
                                                    isOverdue ? "bg-red-50 text-red-600" : "text-slate-500"
                                                )}>
                                                    <span className="text-[11px] font-medium leading-none">
                                                        {opp.fecha_cierre_estimada ? new Date(opp.fecha_cierre_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "-"}
                                                    </span>
                                                    {isOverdue && <span className="text-[8px] font-bold uppercase leading-none">Vencido</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs text-slate-600 truncate block max-w-[110px]" title={opp.vendedor?.full_name || ""}>
                                                    {opp.vendedor?.full_name || "Sin asignar"}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {hasMore && (
                        <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50/50">
                            <button
                                data-testid="opportunities-load-more"
                                onClick={() => loadMore()}
                                disabled={loading}
                                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm disabled:opacity-50"
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

export default function OpportunitiesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando aplicación...</div>}>
            <OpportunitiesContent />
        </Suspense>
    );
}
