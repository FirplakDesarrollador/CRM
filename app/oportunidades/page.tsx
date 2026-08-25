"use client";

import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Search, Filter, Briefcase, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight, Columns3, Check } from "lucide-react";
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
        setAccountOwnerIds,
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
    const [selectedAccountOwnerIds, setSelectedAccountOwnerIds] = useState<string[]>(() => {
        const fromUrl = searchParams.get('owner');
        if (fromUrl) return fromUrl.split(',').filter(Boolean);
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_oportunidades_state');
            if (saved) {
                const ownerParam = new URLSearchParams(saved).get('owner');
                return ownerParam ? ownerParam.split(',').filter(Boolean) : [];
            }
        }
        return [];
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
        if (initialOwner) setAccountOwnerIds(initialOwner.split(',').filter(Boolean));
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
                if (restoredState !== '') {
                    router.replace(`/oportunidades?${restoredState}`, { scroll: false });
                } else {
                    // Ya está vacío, limpiamos la sesión para no entrar en bucle infinito
                    sessionStorage.removeItem('crm_oportunidades_state');
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
        
        if (tab && tab !== 'all') params.set('tab', tab);
        else params.delete('tab');
        
        if (selectedAccountOwnerIds.length > 0) params.set('owner', selectedAccountOwnerIds.join(','));
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
        
        // Evitamos bucles infinitos por orden de parámetros comparándolos ordenados
        const paramsForCompare = new URLSearchParams(params.toString());
        paramsForCompare.sort();
        const currentParamsForCompare = new URLSearchParams(searchParams.toString());
        currentParamsForCompare.sort();
        
        if (paramsForCompare.toString() === currentParamsForCompare.toString()) return;
        
        // Save to sessionStorage for cross-module persistence
        if (queryString) {
            sessionStorage.setItem('crm_oportunidades_state', queryString);
        } else if (searchParams.toString() !== '') {
            sessionStorage.removeItem('crm_oportunidades_state');
        }
        
        const query = queryString ? `?${queryString}` : window.location.pathname;
        router.replace(query.startsWith('?') ? `${window.location.pathname}${query}` : query, { scroll: false });
    }, [tab, selectedAccountOwnerIds, selectedChannel, selectedSubclass, selectedSegment, selectedPhase, statusFilter, startDate, endDate, startClosingDate, endClosingDate, searchParams, router]); // Notice inputValue is NOT in deps here to avoid URL churn during typing


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

    const handleUsersSelect = useCallback((userIds: string[]) => {
        setSelectedAccountOwnerIds(userIds);
        setAccountOwnerIds(userIds);
    }, [setAccountOwnerIds]);

    // Columnas disponibles (excluyendo Acciones que depende del rol)
    const ALL_COLUMNS = [
        { key: 'cuenta',   label: 'Cuenta' },
        { key: 'nombre',   label: 'Nombre' },
        { key: 'fase',     label: 'Fase' },
        { key: 'estado',   label: 'Estado' },
        { key: 'creada',   label: 'Creada' },
        { key: 'valor',    label: 'Valor' },
        { key: 'cierre',   label: 'Cierre' },
        { key: 'vendedor', label: 'Vendedor' },
    ];

    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('crm_opp_visible_cols');
            if (saved) return JSON.parse(saved);
        }
        return ALL_COLUMNS.map(c => c.key);
    });

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            localStorage.setItem('crm_opp_visible_cols', JSON.stringify(next));
            return next;
        });
    };

    const hotData = opportunities.map(opp => ({
        id: opp.id,
        cuenta: opp.account?.nombre || "Sin cuenta",
        nombre: opp.nombre || "Sin nombre",
        fase: opp.fase_data?.nombre || 'Pros.',
        estado: opp.estado_data?.nombre || 'Abierta',
        creada: opp.created_at ? new Date(opp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-",
        valor: opp.amount || 0,
        cierre: opp.fecha_cierre_estimada ? new Date(opp.fecha_cierre_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "-",
        cierre_overdue: opp.fecha_cierre_estimada ? new Date(opp.fecha_cierre_estimada) < new Date() : false,
        vendedor: opp.vendedor?.full_name || "Sin asignar"
    }));

    const ALL_COLUMN_DEFS: Record<string, any> = {
        cuenta: {
            data: 'cuenta', title: 'Cuenta', readOnly: true, width: 160, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        nombre: {
            data: 'nombre', title: 'Nombre', readOnly: true, width: 220, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:#334155;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        fase: {
            data: 'fase', title: 'Fase', readOnly: true, width: 155, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const f = (value || '').toLowerCase();
                let bg, c, bd;
                if (f.includes('ganada'))                                                      { bg='#d1fae5'; c='#065f46'; bd='#a7f3d0'; }
                else if (f.includes('perdida'))                                                { bg='#ffe4e6'; c='#9f1239'; bd='#fecdd3'; }
                else if (f.includes('negociaci'))                                              { bg='#e0e7ff'; c='#3730a3'; bd='#c7d2fe'; }
                else if (f.includes('acuerdo'))                                                { bg='#ccfbf1'; c='#115e59'; bd='#99f6e4'; }
                else if (f.includes('propuesta') || f.includes('presentaci'))                  { bg='#dbeafe'; c='#1e40af'; bd='#bfdbfe'; }
                else if (f.includes('visita'))                                                 { bg='#ede9fe'; c='#5b21b6'; bd='#ddd6fe'; }
                else if (f.includes('prospecci') || f.includes('pros'))                        { bg='#fef3c7'; c='#92400e'; bd='#fde68a'; }
                else                                                                          { bg='#f1f5f9'; c='#475569'; bd='#e2e8f0'; }
                td.innerHTML = `<div style="display:flex;align-items:center;height:100%;"><span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap;background:${bg};color:${c};border:1px solid ${bd};line-height:1.4;">${value || ''}</span></div>`;
                td.style.overflow = 'visible';
                return td;
            }
        },
        estado: {
            data: 'estado', title: 'Estado', readOnly: true, width: 110, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const e = (value || '').toLowerCase();
                let dot = '#94a3b8';
                if (e.includes('abierta'))      dot = '#3b82f6';
                else if (e.includes('ganada'))  dot = '#10b981';
                else if (e.includes('perdida')) dot = '#ef4444';
                td.innerHTML = `<div style="display:flex;align-items:center;gap:6px;height:100%;"><span style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;box-shadow:0 0 0 2px ${dot}33;"></span><span style="font-size:13px;font-weight:500;color:#334155;white-space:nowrap;">${value || ''}</span></div>`;
                return td;
            }
        },
        creada: {
            data: 'creada', title: 'Creada', readOnly: true, width: 105, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                td.innerHTML = `<span style="font-size:12.5px;color:#64748b;font-weight:500;font-variant-numeric:tabular-nums;">${value || '-'}</span>`;
                return td;
            }
        },
        valor: {
            data: 'valor', title: 'Valor', readOnly: true, width: 130, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const num = Number(value) || 0;
                const fmt = new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0, notation: num >= 1_000_000 ? 'compact' : 'standard', compactDisplay:'short' }).format(num);
                td.innerHTML = `<span style="font-weight:700;color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;letter-spacing:-0.01em;">${fmt}</span>`;
                td.style.textAlign = 'right';
                return td;
            }
        },
        cierre: {
            data: 'cierre', title: 'Cierre', readOnly: true, width: 90, wordWrap: false,
            renderer(instance: any, td: HTMLTableCellElement, row: number, ___: number, ____: string, value: any) {
                const rowData = instance.getSourceDataAtRow(row);
                const overdue = rowData?.cierre_overdue;
                const clr = overdue ? '#dc2626' : '#64748b';
                const fw = overdue ? '700' : '500';
                const calIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${clr}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.7;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                td.innerHTML = `<div style="display:flex;align-items:center;gap:5px;height:100%;">${calIcon}<span style="font-size:12.5px;color:${clr};font-weight:${fw};font-variant-numeric:tabular-nums;">${value || '-'}</span></div>`;
                return td;
            }
        },
        vendedor: {
            data: 'vendedor', title: 'Vendedor', readOnly: true, width: 170, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const name = value || 'Sin asignar';
                const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash) % 360;
                const bg = `hsl(${hue},45%,92%)`;
                const fg = `hsl(${hue},55%,35%)`;
                const safe = name.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="display:flex;align-items:center;gap:8px;height:100%;overflow:hidden;"><div style="width:26px;height:26px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;letter-spacing:0.02em;">${initials}</div><span style="font-size:12.5px;color:#334155;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${safe}">${name}</span></div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
    };

    const hotColumns = [
        // Solo incluir las columnas marcadas como visibles, manteniendo el orden original
        ...['cuenta','nombre','fase','estado','creada','valor','cierre','vendedor']
            .filter(key => visibleColumns.includes(key))
            .map(key => ALL_COLUMN_DEFS[key])
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
    const [showColumnPicker, setShowColumnPicker] = useState(false);

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
                            multiple={true}
                            selectedUserIds={selectedAccountOwnerIds}
                            onUsersSelect={handleUsersSelect}
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

                    {/* Botón selector de columnas */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                            className={cn(
                                "p-3 sm:p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-center shrink-0",
                                showColumnPicker
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner"
                                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 shadow-sm"
                            )}
                            title="Columnas visibles"
                        >
                            <Columns3 className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>

                        {/* Popup selector de columnas */}
                        {showColumnPicker && (
                            <>
                                {/* Overlay para cerrar al hacer click fuera */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowColumnPicker(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 p-4 w-52 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Columnas visibles</p>
                                        <button
                                            onClick={() => {
                                                const allKeys = ['cuenta','nombre','fase','estado','creada','valor','cierre','vendedor'];
                                                setVisibleColumns(allKeys);
                                                localStorage.setItem('crm_opp_visible_cols', JSON.stringify(allKeys));
                                            }}
                                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                                        >
                                            Todas
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {ALL_COLUMNS.map(col => (
                                            <button
                                                key={col.key}
                                                onClick={() => toggleColumn(col.key)}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left",
                                                    visibleColumns.includes(col.key)
                                                        ? "bg-indigo-50 text-indigo-700"
                                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                                )}
                                            >
                                                <span className={cn(
                                                    "w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0",
                                                    visibleColumns.includes(col.key)
                                                        ? "bg-indigo-600 border-indigo-600"
                                                        : "border-slate-300"
                                                )}>
                                                    {visibleColumns.includes(col.key) && (
                                                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                                    )}
                                                </span>
                                                {col.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
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
                {(!loading || opportunities.length > 0) && (
                    <div className="flex items-center justify-end mb-3 px-1 z-10">
                        <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                            Total de registros: <strong className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">{count !== undefined && count !== null ? count : opportunities.length}</strong>
                        </span>
                    </div>
                )}
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
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* VISTA DESKTOP: Tabla Premium */}
                        <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex-1 animate-in fade-in duration-500">
                            <style>{`
                                /* ── Scrollbar ── */
                                .opp-hot-wrap .ht_master .wtHolder {
                                    scrollbar-width: thin;
                                    scrollbar-color: #c7d2de transparent;
                                }
                                .opp-hot-wrap .ht_master .wtHolder::-webkit-scrollbar { width: 6px; height: 6px; }
                                .opp-hot-wrap .ht_master .wtHolder::-webkit-scrollbar-thumb {
                                    background: #c7d2de; border-radius: 99px;
                                }
                                .opp-hot-wrap .ht_master .wtHolder::-webkit-scrollbar-track { background: transparent; }

                                /* ── Header Cells ── */
                                .opp-hot-wrap .handsontable th {
                                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
                                    color: #475569 !important;
                                    font-size: 10.5px !important;
                                    font-weight: 800 !important;
                                    letter-spacing: 0.08em !important;
                                    text-transform: uppercase !important;
                                    border-bottom: 2px solid #e2e8f0 !important;
                                    border-right: 1px solid #e8ecf1 !important;
                                    padding: 0 14px !important;
                                    height: 40px !important;
                                    white-space: nowrap !important;
                                }
                                .opp-hot-wrap .handsontable th:last-child {
                                    border-right: none !important;
                                }

                                /* ── Row Number (Row Headers) ── */
                                .opp-hot-wrap .handsontable .ht_clone_inline_start th,
                                .opp-hot-wrap .handsontable th.rowHeader,
                                .opp-hot-wrap .handsontable .ht_clone_inline_start td {
                                    background: #f8fafc !important;
                                    color: #94a3b8 !important;
                                    font-size: 10px !important;
                                    font-weight: 600 !important;
                                    border-right: 1px solid #e2e8f0 !important;
                                    text-align: center !important;
                                    width: 42px !important;
                                    min-width: 42px !important;
                                    max-width: 42px !important;
                                }

                                /* ── Data Cells ── */
                                .opp-hot-wrap .handsontable td {
                                    font-size: 13px !important;
                                    color: #334155 !important;
                                    border-bottom: 1px solid #f1f5f9 !important;
                                    border-right: 1px solid transparent !important;
                                    height: 42px !important;
                                    padding: 0 14px !important;
                                    vertical-align: middle !important;
                                    font-family: inherit !important;
                                    transition: background 0.15s ease, box-shadow 0.15s ease !important;
                                    line-height: 1.4 !important;
                                }

                                /* ── Zebra Striping ── */
                                .opp-hot-wrap .handsontable tr:nth-child(even) td {
                                    background: #fafbfd !important;
                                }
                                .opp-hot-wrap .handsontable tr:nth-child(odd) td {
                                    background: #ffffff !important;
                                }

                                /* ── Row Hover ── */
                                .opp-hot-wrap .handsontable tbody tr:hover td {
                                    background: #eff6ff !important;
                                    cursor: pointer;
                                }
                                .opp-hot-wrap .handsontable tbody tr:hover td:first-child {
                                    box-shadow: inset 3px 0 0 0 #3b82f6 !important;
                                }

                                /* ── Selection ── */
                                .opp-hot-wrap .handsontable .wtBorder.current {
                                    background: #3b82f6 !important;
                                }
                                .opp-hot-wrap .handsontable td.area {
                                    background: #eff6ff !important;
                                }
                                .opp-hot-wrap .handsontable td.current {
                                    background: #e0edff !important;
                                }

                                /* ── Dropdown Filter Popover ── */
                                .opp-hot-wrap .handsontable .htDropdownMenu,
                                .htDropdownMenu .ht_master .wtHolder {
                                    border-radius: 12px !important;
                                    overflow: hidden !important;
                                }
                                .htDropdownMenu {
                                    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.06) !important;
                                    border: none !important;
                                    border-radius: 12px !important;
                                }
                                .opp-hot-wrap .handsontable .changeType {
                                    border-color: #e2e8f0 !important;
                                }

                                /* ── Column Resize Handle ── */
                                .opp-hot-wrap .handsontable .manualColumnResizer {
                                    border-right: 2px solid #3b82f6 !important;
                                    opacity: 0;
                                    transition: opacity 0.2s ease;
                                }
                                .opp-hot-wrap .handsontable th:hover .manualColumnResizer {
                                    opacity: 1;
                                }

                                /* ── Corner Header ── */
                                .opp-hot-wrap .handsontable .ht_clone_top_inline_start_corner th {
                                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
                                    border-right: 1px solid #e2e8f0 !important;
                                    border-bottom: 2px solid #e2e8f0 !important;
                                }

                                /* ── Force single-line cells ── */
                                .opp-hot-wrap .handsontable td {
                                    white-space: nowrap !important;
                                    overflow: hidden !important;
                                    text-overflow: ellipsis !important;
                                }
                            `}</style>
                            <div className="w-full relative z-0 opp-hot-wrap" style={{ minHeight: '400px' }}>
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
