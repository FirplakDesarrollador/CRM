"use client";

import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, Filter, Briefcase, User } from "lucide-react";
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
        setStatusFilter
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

    // On mount: apply initial filter values from URL to the server hook
    // This is critical for the "back button" scenario where URL has params but hook starts fresh
    useEffect(() => {
        const initialTab = (searchParams.get('tab') as any) || 'mine';
        const initialSearch = searchParams.get('search') || '';
        const initialOwner = searchParams.get('owner') || null;

        // Apply tab, search, owner to hook (channel/status are handled by OpportunityFilters on init)
        if (initialSearch) setSearchTerm(initialSearch);
        if (initialOwner) setAccountOwnerId(initialOwner);
        setUserFilter(initialTab === 'team' ? 'team' : 'mine');
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

    // Sync to URL
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);
            
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
            
            const queryString = params.toString();
            
            // Save to sessionStorage for cross-module persistence
            if (queryString) {
                sessionStorage.setItem('crm_oportunidades_state', queryString);
            } else if (searchParams.toString() !== '') {
                sessionStorage.removeItem('crm_oportunidades_state');
            }
            
            const query = queryString ? `?${queryString}` : window.location.pathname;
            router.replace(query.startsWith('?') ? `${window.location.pathname}${query}` : query, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, tab, selectedAccountOwnerId, selectedChannel, statusFilter, searchParams, setSearchTerm, router]);

    const handleFilterChange = useCallback(({ channelId, subclassificationId, segmentId, phaseId, statusFilter: newStatus }: { channelId: string | null; subclassificationId: number | null; segmentId: number | null; phaseId: number | null; statusFilter: any }) => {
        setSelectedChannel(channelId);
        setStatusFilterState(newStatus);
        
        setChannelFilter(channelId);
        setSubclassificationFilter(subclassificationId);
        setSegmentFilter(segmentId);
        setPhaseFilter(phaseId);
        setStatusFilter(newStatus);
    }, [setChannelFilter, setSubclassificationFilter, setSegmentFilter, setPhaseFilter, setStatusFilter]);

    // PERF FIX: Stable callback references
    const handleTabChange = useCallback((newTab: 'mine' | 'collab' | 'team') => {
        setTab(newTab);
        setUserFilter(newTab === 'team' ? 'team' : 'mine');
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
                <div data-testid="opportunities-list" className="grid gap-3">
                    {opportunities.map(opp => {
                        const isOverdue = isDateOverdue(opp.fecha_cierre_estimada);
                        return (
                            <Link 
                                key={opp.id} 
                                href={`/oportunidades/${opp.id}`} 
                                data-testid={`opportunities-row-${opp.id}`}
                                onClick={() => {
                                    // Save state immediately before navigating
                                    const params = new URLSearchParams(Array.from(searchParams.entries()));
                                    params.set('id', opp.id);
                                    sessionStorage.setItem('crm_oportunidades_state', params.toString());
                                }}
                            >
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
                                                        • Cierre: {formatColombiaDate(opp.fecha_cierre_estimada, "dd/MM/yyyy")}
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
                                data-testid="opportunities-load-more"
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

export default function OpportunitiesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando aplicación...</div>}>
            <OpportunitiesContent />
        </Suspense>
    );
}
