"use client";

import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, Filter, Briefcase, Trash2, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { UserPickerFilter } from "@/components/cuentas/UserPickerFilter";
import { OpportunityFilters } from "@/components/oportunidades/OpportunityFilters";
import { formatColombiaDate, isDateOverdue } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";
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
    } = useOpportunitiesServer({ pageSize: 50 });

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

    const handleDeleteOpportunity = async (oppId: string) => {
        try {
            // Eliminar registros relacionados manualmente para evitar errores de llave foránea (FK constraint)
            await supabase.from('CRM_Actividades').delete().eq('oportunidad_id', oppId);
            await supabase.from('CRM_Pagos').delete().eq('oportunidad_id', oppId);
            await supabase.from('CRM_Comisiones_Movimientos').delete().eq('oportunidad_id', oppId);
            // CRM_Oportunidades_Colaboradores tiene ON DELETE CASCADE pero lo aseguramos
            await supabase.from('CRM_Oportunidades_Colaboradores').delete().eq('oportunidad_id', oppId);
            
            // También eliminamos las cotizaciones y sus items vinculados
            const { data: quotes } = await supabase.from('CRM_Cotizaciones').select('id').eq('opportunity_id', oppId);
            if (quotes && quotes.length > 0) {
                const quoteIds = quotes.map(q => q.id);
                await supabase.from('CRM_CotizacionItems').delete().in('cotizacion_id', quoteIds);
            }
            
            const { error: quoteError } = await supabase.from('CRM_Cotizaciones').delete().eq('opportunity_id', oppId);
            if (quoteError) throw quoteError;
            
            const { error } = await supabase.from('CRM_Oportunidades').delete().eq('id', oppId);
            if (error) throw error;
            
            refresh();
        } catch (error: any) {
            console.error("Error eliminando la oportunidad:", error);
            if (error.message?.includes('CRM_ComisionLedger is immutable')) {
                alert("No se puede eliminar la oportunidad porque ya tiene comisiones generadas en el Ledger Financiero. Por políticas de auditoría, estos registros son inmutables. \n\nPara solucionarlo, debes cambiar el estado de la oportunidad a 'Perdida' o 'Anulada' en lugar de eliminarla de la base de datos.");
            } else {
                alert("Error eliminando la oportunidad: " + error.message);
            }
        }
    };

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
        ...(userRole === 'ADMIN' ? [{
            data: 'acciones',
            title: 'Acciones',
            readOnly: true,
            renderer: function(instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) {
                td.innerHTML = `
                    <div style="display: flex; gap: 12px; justify-content: center; align-items: center; height: 100%; width: 100%;">
                        <button class="edit-action-btn" title="Editar" style="cursor:pointer; color:#2563eb; background:none; border:none; padding:0; display:flex; align-items:center;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button class="delete-action-btn" title="Eliminar" style="cursor:pointer; color:#dc2626; background:none; border:none; padding:0; display:flex; align-items:center;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                    </div>
                `;
                return td;
            }
        }] : []),
        { data: 'cuenta', title: 'Cuenta', readOnly: true },
        { data: 'nombre', title: 'Nombre', readOnly: true },
        { data: 'fase', title: 'Fase', readOnly: true },
        { data: 'estado', title: 'Estado', readOnly: true },
        { data: 'creada', title: 'Creada', readOnly: true },
        { data: 'valor', title: 'Valor', type: 'numeric', numericFormat: { pattern: '$ 0,0', culture: 'es-CO' }, readOnly: true },
        { data: 'cierre', title: 'Cierre', readOnly: true },
        { data: 'vendedor', title: 'Vendedor', readOnly: true }
    ];

    const getPhaseBadge = (fase: string) => {
        const lowerFase = fase.toLowerCase();
        let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
        if (lowerFase.includes('ganada')) colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
        else if (lowerFase.includes('perdida')) colorClass = 'bg-rose-100 text-rose-700 border-rose-200';
        else if (lowerFase.includes('propuesta') || lowerFase.includes('acuerdo')) colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
        else if (lowerFase.includes('prospección') || lowerFase.includes('pros.')) colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
        
        return <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap", colorClass)}>{fase}</span>;
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
    };

    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    return (
        <div data-testid="opportunities-page" className="space-y-4 md:space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
            {/* Header Rediseñado */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/80 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-50/50 rounded-full blur-2xl -ml-10 -mb-10 opacity-60 pointer-events-none"></div>
                <div className="flex flex-col gap-1.5 z-10">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            Oportunidades
                        </h1>
                        {count !== undefined && count !== null && !loading && (
                            <span className="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-sm">
                                {count}
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm hidden sm:block">Gestiona y haz seguimiento a todas las oportunidades comerciales.</p>
                </div>
                <div className="z-10 w-full sm:w-auto mt-2 sm:mt-0">
                    <Link
                        href="/oportunidades/nueva"
                        data-testid="opportunities-create-button"
                        className="group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-3 sm:py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-all active:scale-[0.98] w-full"
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        Nueva Oportunidad
                    </Link>
                </div>
            </div>

            {/* Controles Principales */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between gap-4 relative z-20">
                {/* Segmented Control para Tabs */}
                <div className="flex p-1 bg-slate-100/80 rounded-xl overflow-x-auto hide-scrollbar ring-1 ring-slate-200/50 inset-ring w-full xl:w-auto touch-pan-x">
                    {[
                        { id: 'all', label: 'Todas' },
                        { id: 'mine', label: 'Mis Oportunidades' },
                        { id: 'collab', label: 'Colaboración' },
                        ...(userRole === 'ADMIN' ? [{ id: 'team', label: 'Equipo' }] : []),
                        { id: 'web', label: 'Web' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => handleTabChange(t.id as any)}
                            className={cn(
                                "px-4 py-2.5 sm:py-2 text-sm font-semibold rounded-lg transition-all duration-300 whitespace-nowrap flex-shrink-0 relative",
                                tab === t.id 
                                    ? "text-blue-700 bg-white shadow-sm ring-1 ring-slate-200/50" 
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                            )}
                        >
                            {t.label}
                            {t.id === 'web' && tab === 'web' && !loading && (
                                <span className="ml-2 inline-flex items-center justify-center text-[10px] bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full font-bold">{count}</span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 items-center w-full xl:w-auto">
                    <div className="hidden sm:block">
                        <UserPickerFilter
                            selectedUserId={selectedAccountOwnerId}
                            onUserSelect={handleUserSelect}
                        />
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-3 sm:py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={cn(
                            "p-3 sm:p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-center shrink-0",
                            showAdvancedFilters 
                                ? "bg-blue-50 border-blue-200 text-blue-700 shadow-inner" 
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 shadow-sm"
                        )}
                        title="Filtros Avanzados"
                    >
                        <Filter className={cn("w-5 h-5 sm:w-4 sm:h-4 transition-transform duration-300", showAdvancedFilters && "fill-blue-100")} />
                    </button>
                </div>
            </div>

            {/* Filtros Avanzados (Colapsables) */}
            {showAdvancedFilters && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4 fade-in duration-300 relative z-10">
                    <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-600" />
                        Filtros Avanzados
                    </h3>
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
            )}

            {/* Listado (Tarjetas en Móvil, Tabla en Desktop) */}
            <div className="flex flex-col relative min-h-[450px] transition-all duration-300">
                {loading && opportunities.length === 0 ? (
                    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 sm:h-16 bg-slate-50 rounded-xl animate-pulse border border-slate-100" />
                        ))}
                    </div>
                ) : opportunities.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center p-10 sm:p-16 text-center h-full my-auto animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-inner">
                            <Briefcase className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No hay oportunidades</h3>
                        <p className="text-slate-500 max-w-sm text-sm leading-relaxed">Prueba ajustando los filtros de búsqueda o crea una nueva oportunidad comercial para verla aquí.</p>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL: Tarjetas */}
                        <div className="grid grid-cols-1 gap-3 md:hidden">
                            {opportunities.map((opp) => (
                                <div key={opp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 active:scale-[0.99] transition-all relative">
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 text-sm mb-0.5 truncate">
                                                {opp.account?.nombre || "Sin cuenta"}
                                            </div>
                                            <div className="text-slate-500 text-xs truncate">
                                                {opp.nombre || "Sin nombre"}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-start">
                                            {getPhaseBadge(opp.fase_data?.nombre || 'Pros.')}
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-slate-50/50 grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                                        <div>
                                            <span className="block text-slate-400 mb-1">Estado</span>
                                            <div className="flex items-center gap-1.5 font-medium text-slate-700">
                                                <span className={cn("w-2 h-2 rounded-full", opp.estado_data?.nombre?.toLowerCase() === 'abierta' ? 'bg-blue-500' : 'bg-slate-300')}></span>
                                                {opp.estado_data?.nombre || 'Abierta'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 mb-1">Valor</span>
                                            <span className="font-bold text-slate-800">{formatCurrency(opp.amount || 0)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 mb-1">Cierre Est.</span>
                                            <span className="font-medium text-slate-700">{opp.fecha_cierre_estimada ? new Date(opp.fecha_cierre_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : "-"}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 mb-1">Vendedor</span>
                                            <div className="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                                                <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">
                                                    {getInitials(opp.vendedor?.full_name || "Sin")}
                                                </div>
                                                <span className="truncate">{opp.vendedor?.full_name || "Sin asignar"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex divide-x divide-slate-100 border-t border-slate-100 bg-white">
                                        <button 
                                            onClick={() => {
                                                const params = new URLSearchParams(Array.from(searchParams.entries()));
                                                params.set('id', opp.id);
                                                sessionStorage.setItem('crm_oportunidades_state', params.toString());
                                                router.push(`/oportunidades/${opp.id}`);
                                            }}
                                            className="flex-1 py-3 text-sm font-semibold text-blue-600 flex items-center justify-center gap-2 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                                        >
                                            <Search className="w-4 h-4" /> Ver / Editar
                                        </button>
                                        {userRole === 'ADMIN' && (
                                            <button 
                                                onClick={() => {
                                                    if (window.confirm(`¿Estás seguro de que deseas eliminar la oportunidad "${opp.nombre || 'Sin nombre'}"?`)) {
                                                        handleDeleteOpportunity(opp.id);
                                                    }
                                                }}
                                                className="px-5 py-3 text-sm font-semibold text-rose-500 flex items-center justify-center hover:bg-rose-50 active:bg-rose-100 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* VISTA DESKTOP: Tabla Moderna (Handsontable con filtros) */}
                        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 animate-in fade-in duration-500">
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
                                                const target = event.target as HTMLElement;
                                                if (target.closest('.edit-action-btn')) {
                                                    router.push(`/oportunidades/${opp.id}`);
                                                    return;
                                                }
                                                if (target.closest('.delete-action-btn')) {
                                                    if (window.confirm(`¿Estás seguro de que deseas eliminar la oportunidad "${opp.nombre}"?`)) {
                                                        handleDeleteOpportunity(opp.id);
                                                    }
                                                    return;
                                                }
                                                
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
                        </div>
                    </>
                )}
                
                {hasMore && opportunities.length > 0 && (
                    <div className="p-4 flex justify-center mt-4">
                        <button
                            onClick={() => loadMore()}
                            disabled={loading}
                            className="w-full md:w-auto px-6 py-3.5 md:py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                        >
                            {loading && <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin"></div>}
                            {loading ? 'Cargando...' : 'Cargar más resultados'}
                        </button>
                    </div>
                )}
            </div>
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
