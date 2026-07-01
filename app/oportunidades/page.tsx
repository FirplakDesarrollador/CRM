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
import dynamic from 'next/dynamic';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

const HotTable = dynamic(() => import('@/components/HotTableWrapper'), { ssr: false });

function OpportunitiesContent() {
    const { role: userRole } = useCurrentUser();
    const searchParams = useSearchParams();
    const router = useRouter();

    // Server Side Hook
    const {
        data: opportunities,
        count,
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
    } = useOpportunitiesServer({ pageSize: 10000 });

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
    const [tab, setTab] = useState<'mine' | 'collab' | 'all' | 'team' | 'web'>(() => {
        const fromUrl = searchParams.get('tab');
        if (fromUrl) return (fromUrl as any);
        return 'all';
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
    const [selectedSubclass, setSelectedSubclass] = useState<number | null>(() => {
        const fromUrl = searchParams.get('subclass');
        if (fromUrl) return Number(fromUrl);
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            const value = saved ? new URLSearchParams(saved).get('subclass') : null;
            return value ? Number(value) : null;
        }
        return null;
    });
    const [selectedSegment, setSelectedSegment] = useState<number | null>(() => {
        const fromUrl = searchParams.get('segment');
        if (fromUrl) return Number(fromUrl);
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            const value = saved ? new URLSearchParams(saved).get('segment') : null;
            return value ? Number(value) : null;
        }
        return null;
    });
    const [selectedPhase, setSelectedPhase] = useState<number | null>(() => {
        const fromUrl = searchParams.get('phase');
        if (fromUrl) return Number(fromUrl);
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            const value = saved ? new URLSearchParams(saved).get('phase') : null;
            return value ? Number(value) : null;
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
        const initialTab = (searchParams.get('tab') as any) || 'all';
        const initialSearch = searchParams.get('search') || '';
        const initialOwner = searchParams.get('owner') || null;
        const initialChannel = searchParams.get('channel') || selectedChannel;
        const initialSubclass = searchParams.get('subclass') || (selectedSubclass ? String(selectedSubclass) : null);
        const initialSegment = searchParams.get('segment') || (selectedSegment ? String(selectedSegment) : null);
        const initialPhase = searchParams.get('phase') || (selectedPhase ? String(selectedPhase) : null);

        // Apply tab, search, owner and restored hierarchical filters to hook
        if (initialSearch) setSearchTerm(initialSearch);
        if (initialOwner) setAccountOwnerId(initialOwner);
        if (initialChannel) setChannelFilter(initialChannel);
        if (initialSubclass) setSubclassificationFilter(Number(initialSubclass));
        if (initialSegment) setSegmentFilter(Number(initialSegment));
        if (initialPhase) setPhaseFilter(Number(initialPhase));
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
                // Evitamos redireccionar al detalle por defecto para siempre mostrar la lista inicial
                savedParams.delete('id');
                savedParams.delete('tab');
                const restoredState = savedParams.toString();
                router.replace(restoredState ? `/oportunidades?${restoredState}` : '/oportunidades', { scroll: false });
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
        
        if (tab && tab !== 'all') params.set('tab', tab);
        else params.delete('tab');
        
        if (selectedAccountOwnerId) params.set('owner', selectedAccountOwnerId);
        else params.delete('owner');

        if (selectedChannel) params.set('channel', selectedChannel);
        else params.delete('channel');

        if (selectedSubclass) params.set('subclass', String(selectedSubclass));
        else params.delete('subclass');

        if (selectedSegment) params.set('segment', String(selectedSegment));
        else params.delete('segment');

        if (selectedPhase) params.set('phase', String(selectedPhase));
        else params.delete('phase');

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
    }, [tab, selectedAccountOwnerId, selectedChannel, selectedSubclass, selectedSegment, selectedPhase, statusFilter, startDate, endDate, startClosingDate, endClosingDate, searchParams, router]); // Notice inputValue is NOT in deps here to avoid URL churn during typing


    const handleFilterChange = useCallback(({ 
        channelId, subclassificationId, segmentId, phaseId, statusFilter: newStatus,
        startDate: sD, endDate: eD, startClosingDate: sCD, endClosingDate: eCD
    }: any) => {
        setSelectedChannel(channelId);
        setSelectedSubclass(subclassificationId);
        setSelectedSegment(segmentId);
        setSelectedPhase(phaseId);
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
    const handleTabChange = useCallback((newTab: 'mine' | 'collab' | 'all' | 'team' | 'web') => {
        setTab(newTab);
        setUserFilter(newTab);
    }, [setUserFilter]);

    const handleUserSelect = useCallback((userId: string | null) => {
        setSelectedAccountOwnerId(userId);
        setAccountOwnerId(userId);
    }, [setAccountOwnerId]);

    const hotData = opportunities.map(opp => ({
        id: opp.id,
        cuenta: opp.account?.nombre || "Sin cuenta",
        nombre: opp.nombre || "Sin nombre",
        fase: opp.fase_data?.nombre || 'Pros.',
        estado: opp.estado_data?.nombre || 'Abierta',
        creada: opp.created_at ? new Date(opp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-",
        valor: opp.amount || 0,
        cierre: opp.fecha_cierre_estimada ? new Date(opp.fecha_cierre_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "-",
        vendedor: opp.vendedor?.full_name || "Sin asignar"
    }));

    const hotColumns = [
        { data: 'cuenta', title: 'Cuenta', readOnly: true },
        { data: 'nombre', title: 'Nombre', readOnly: true },
        { data: 'fase', title: 'Fase', readOnly: true },
        { data: 'estado', title: 'Estado', readOnly: true },
        { data: 'creada', title: 'Creada', readOnly: true },
        { data: 'valor', title: 'Valor', type: 'numeric', numericFormat: { pattern: '$ 0,0', culture: 'es-CO' }, readOnly: true },
        { data: 'cierre', title: 'Cierre', readOnly: true },
        { data: 'vendedor', title: 'Vendedor', readOnly: true }
    ];

    return (
        <div data-testid="opportunities-page" className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Oportunidades
                        {count !== undefined && count !== null && !loading && (
                            <span className="ml-2 text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full align-middle">
                                {count}
                            </span>
                        )}
                    </h1>

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
                            data-testid="opportunities-tab-all"
                            onClick={() => handleTabChange('all')}
                            className={cn(
                                "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                tab === 'all' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            Todas
                        </button>
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
                        <button
                            data-testid="opportunities-tab-web"
                            onClick={() => handleTabChange('web')}
                            className={cn(
                                "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                tab === 'web' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            Oportunidades desde página {tab === 'web' && !loading && `(${count})`}
                        </button>
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
                        initialSubclassId={selectedSubclass}
                        initialSegmentId={selectedSegment}
                        initialPhaseId={selectedPhase}
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
                    <div className="w-full relative z-0" style={{ minHeight: '400px' }}>
                        <HotTable
                            data={hotData}
                            columns={hotColumns}
                            rowHeaders={true}
                            colHeaders={true}
                            filters={true}
                            dropdownMenu={true}
                            width="100%"
                            height="calc(100vh - 280px)"
                            autoColumnSize={false}
                            autoRowSize={false}
                            renderAllRows={false}
                            licenseKey="non-commercial-and-evaluation"
                            afterOnCellMouseDown={(event, coords, td) => {
                                if (coords.row >= 0) {
                                    const opp = hotData[coords.row];
                                    if (opp && opp.id) {
                                        const params = new URLSearchParams(Array.from(searchParams.entries()));
                                        params.set('id', opp.id);
                                        sessionStorage.setItem('crm_oportunidades_state', params.toString());
                                        router.push(`/oportunidades/${opp.id}`);
                                    }
                                }
                            }}
                            stretchH="all"
                            className="text-sm font-sans"
                        />
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
