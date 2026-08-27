"use client";

import { useAccountsServer, AccountServer } from "@/lib/hooks/useAccountsServer";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Building, User, Pencil, Medal, Trash2, ArrowUpDown, ChevronUp, ChevronDown, MapPin, Briefcase, DollarSign } from "lucide-react";
import { UserPickerFilter } from "@/components/cuentas/UserPickerFilter";
import { AccountFilters } from "@/components/cuentas/AccountFilters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { cn } from "@/components/ui/utils";
import { AccountDeleteModal } from "@/components/cuentas/AccountDeleteModal";
import { DataListToolbar } from "@/components/ui/DataListToolbar";
import dynamic from 'next/dynamic';

const HotTable = dynamic(() => import('@/components/HotTableWrapper'), { ssr: false });

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(value);
};

function AccountsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isAdmin, hasCoordinatorAccess } = useCurrentUser();
    const { deleteAccount } = useAccounts();

    const {
        data: accounts,
        count,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setAssignedUserId,
        setChannelFilter,
        setSubclassificationFilter,
        setNivelPremiumFilter,
        setStartDate,
        setEndDate,
        setSortField,
        setSortAsc,
        setWebFilter,
        webFilter,
        sortField,
        sortAsc,
        refresh
    } = useAccountsServer({ pageSize: 50 });

    const [showCreate, setShowCreate] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const lastProcessedUrlIdRef = useRef<string | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(() => Boolean(searchParams.get('channel') || searchParams.get('subclass') || searchParams.get('nivel') || searchParams.get('start') || searchParams.get('end')));
    const [inputValue, setInputValue] = useState(() => {
        const fromUrl = searchParams.get('search');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_cuentas_state');
            if (saved) return new URLSearchParams(saved).get('search') || "";
        }
        return "";
    });

    const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
        const fromUrl = searchParams.get('user');
        if (fromUrl) return fromUrl;
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('crm_cuentas_state');
            if (saved) return new URLSearchParams(saved).get('user') || null;
        }
        return null;
    });

    const [currentChannel, setCurrentChannel] = useState<string | null>(() => {
        return searchParams.get('channel') || (typeof window !== 'undefined' ? new URLSearchParams(sessionStorage.getItem('crm_cuentas_state') || '').get('channel') : null);
    });

    const [currentSubclass, setCurrentSubclass] = useState<number | null>(() => {
        const value = searchParams.get('subclass') || (typeof window !== 'undefined' ? new URLSearchParams(sessionStorage.getItem('crm_cuentas_state') || '').get('subclass') : null);
        return value ? Number(value) : null;
    });

    const [currentNivel, setCurrentNivel] = useState<string | null>(() => {
        return searchParams.get('nivel') || (typeof window !== 'undefined' ? new URLSearchParams(sessionStorage.getItem('crm_cuentas_state') || '').get('nivel') : null);
    });
    const [currentStartDate, setCurrentStartDate] = useState<string | null>(() => searchParams.get('start') || (typeof window !== 'undefined' ? new URLSearchParams(sessionStorage.getItem('crm_cuentas_state') || '').get('start') : null));
    const [currentEndDate, setCurrentEndDate] = useState<string | null>(() => searchParams.get('end') || (typeof window !== 'undefined' ? new URLSearchParams(sessionStorage.getItem('crm_cuentas_state') || '').get('end') : null));

    // Handle Sort
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

    // Filter Changes
    const handleFilterChange = useCallback(({ channelId, subclassificationId, nivelPremium, startDate, endDate }: any) => {
        setChannelFilter(channelId);
        setSubclassificationFilter(subclassificationId);
        setNivelPremiumFilter(nivelPremium);
        setStartDate(startDate);
        setEndDate(endDate);

        setCurrentChannel(channelId);
        setCurrentSubclass(subclassificationId);
        setCurrentNivel(nivelPremium);
        setCurrentStartDate(startDate);
        setCurrentEndDate(endDate);
    }, [setChannelFilter, setSubclassificationFilter, setNivelPremiumFilter, setStartDate, setEndDate]);

    const handleUserSelect = useCallback((userId: string | null) => {
        setSelectedUserId(userId);
        setAssignedUserId(userId);
    }, [setAssignedUserId]);

    // Initial Sync from URL
    useEffect(() => {
        const saved = new URLSearchParams(typeof window !== 'undefined' ? sessionStorage.getItem('crm_cuentas_state') || '' : '');
        const query = searchParams.get('search') || saved.get('search') || '';
        const userQuery = searchParams.get('user') || saved.get('user') || null;
        const channel = searchParams.get('channel') || saved.get('channel') || null;
        const subclass = searchParams.get('subclass') || saved.get('subclass');
        const nivel = searchParams.get('nivel') || saved.get('nivel') || null;
        const start = searchParams.get('start') || saved.get('start') || null;
        const end = searchParams.get('end') || saved.get('end') || null;
        const source = searchParams.get('source') || saved.get('source');
        const sort = searchParams.get('sort') || saved.get('sort');
        const direction = searchParams.get('dir') || saved.get('dir');
        if (query) setSearchTerm(query);
        if (userQuery) setAssignedUserId(userQuery);
        if (channel) setChannelFilter(channel);
        if (subclass) setSubclassificationFilter(Number(subclass));
        if (nivel) setNivelPremiumFilter(nivel);
        if (start) setStartDate(start);
        if (end) setEndDate(end);
        if (source === 'web') setWebFilter(true);
        if (sort) setSortField(sort);
        if (direction) setSortAsc(direction === 'asc');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore the last list context when returning from navigation, but never reopen a record.
    useEffect(() => {
        if (typeof window === 'undefined' || searchParams.toString() !== '') return;
        const savedState = sessionStorage.getItem('crm_cuentas_state');
        if (!savedState) return;
        const params = new URLSearchParams(savedState);
        params.delete('id');
        const restored = params.toString();
        if (restored) router.replace(`/cuentas?${restored}`, { scroll: false });
    }, [searchParams, router]);

    // Deep linking: Automatically fetch and open account by ID from URL
    useEffect(() => {
        const id = searchParams.get('id');
        
        if (id === lastProcessedUrlIdRef.current) return;
        lastProcessedUrlIdRef.current = id;

        if (!id) {
            if (editingAccount) {
                setEditingAccount(null);
            }
            return;
        }

        if (editingAccount?.id === id) return;

        const findAndOpen = async () => {
            // 1. Check if already in current list
            const existing = accounts?.find((a: any) => a.id === id);
            if (existing) {
                setEditingAccount(existing);
                setShowCreate(false);
                return;
            }

            // 2. Fallback to Supabase (for JIT access when not in list)
            try {
                const { data: account, error } = await supabase
                    .from('CRM_Cuentas')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (account && !error) {
                    setEditingAccount(account);
                    setShowCreate(false);
                }
            } catch (err) {
                console.warn("[AccountsPage] Error fetching account for deep link:", err);
            }
        };

        findAndOpen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, accounts]);

    // Sync to URL & SessionStorage
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);

            const params = new URLSearchParams(Array.from(searchParams.entries()));
            if (inputValue) params.set('search', inputValue); else params.delete('search');
            if (selectedUserId) params.set('user', selectedUserId); else params.delete('user');
            if (currentChannel) params.set('channel', currentChannel); else params.delete('channel');
            if (currentSubclass) params.set('subclass', String(currentSubclass)); else params.delete('subclass');
            if (currentNivel) params.set('nivel', currentNivel); else params.delete('nivel');
            if (currentStartDate) params.set('start', currentStartDate); else params.delete('start');
            if (currentEndDate) params.set('end', currentEndDate); else params.delete('end');
            if (webFilter) params.set('source', 'web'); else params.delete('source');
            if (sortField !== 'updated_at') params.set('sort', sortField); else params.delete('sort');
            if (sortAsc) params.set('dir', 'asc'); else params.delete('dir');

            if (editingAccount?.id) params.set('id', editingAccount.id); else params.delete('id');

            const queryString = params.toString();
            if (queryString === searchParams.toString()) return;

            if (queryString) sessionStorage.setItem('crm_cuentas_state', queryString);
            else if (searchParams.toString() !== '') sessionStorage.removeItem('crm_cuentas_state');

            const queryLink = queryString ? `?${queryString}` : window.location.pathname;
            router.replace(queryLink.startsWith('?') ? `${window.location.pathname}${queryLink}` : queryLink, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, selectedUserId, currentChannel, currentSubclass, currentNivel, currentStartDate, currentEndDate, webFilter, sortField, sortAsc, editingAccount?.id, searchParams, setSearchTerm, router]);

    const handleEdit = async (acc: any) => {
        setEditingAccount(acc);
        setShowCreate(false);
        document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSuccess = () => {
        refresh();
        setShowCreate(false);
        setEditingAccount(null);
    };

    const handleDelete = (e: React.MouseEvent, acc: any) => {
        e.stopPropagation();
        setAccountToDelete(acc);
    };

    const confirmDelete = async (accountId: string) => {
        try {
            await deleteAccount(accountId);
            refresh();
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    // Preparar datos para Handsontable
    const hotData = accounts.map(acc => ({
        id: acc.id,
        nombre: acc.nombre,
        ciudad: acc.ciudad || "Sin ciudad",
        canal_id: acc.canal_id || "-",
        tipo: acc.subclasificacion_id || "",
        potencial_venta: acc.potencial_venta || 0,
        vendedor: acc.owner_name || "Sin asignar",
        nivel: acc.nivel_premium || "-",
        creacion: acc.created_at ? new Date(acc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "-",
        actualizado: acc.updated_at ? new Date(acc.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "-",
        _original: acc
    }));

    const hotColumns = [
        { data: 'nombre', title: 'Cuenta', readOnly: true, width: 220, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'ciudad', title: 'Ubicación', readOnly: true, width: 140, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const v = value || '';
                const safe = v.replace(/"/g, '&quot;');
                td.innerHTML = `<div style="color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${safe}">${v}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'canal_id', title: 'Canal', readOnly: true, width: 120, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                td.innerHTML = `<div style="color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${value || '-'}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'tipo', title: 'Tipo', readOnly: true, width: 120, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                td.innerHTML = `<div style="color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${value || '-'}</div>`;
                td.style.overflow = 'hidden';
                return td;
            }
        },
        { data: 'potencial_venta', title: 'Potencial Venta', readOnly: true, width: 130, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const num = Number(value) || 0;
                const fmt = new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0, notation: num >= 1_000_000 ? 'compact' : 'standard', compactDisplay:'short' }).format(num);
                td.innerHTML = `<span style="font-weight:700;color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;letter-spacing:-0.01em;">${fmt}</span>`;
                td.style.textAlign = 'right';
                return td;
            }
        },
        { data: 'vendedor', title: 'Vendedor', readOnly: true, width: 170, wordWrap: false,
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
        { data: 'nivel', title: 'Nivel', readOnly: true, width: 110, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                const isPremium = value === 'PREMIUM';
                const bg = isPremium ? '#fef3c7' : '#f1f5f9';
                const c = isPremium ? '#92400e' : '#475569';
                const bd = isPremium ? '#fde68a' : '#e2e8f0';
                td.innerHTML = `<div style="display:flex;align-items:center;height:100%;"><span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap;background:${bg};color:${c};border:1px solid ${bd};line-height:1.4;">${value || '-'}</span></div>`;
                td.style.overflow = 'visible';
                return td;
            }
        },
        { data: 'creacion', title: 'Creación', readOnly: true, width: 90, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                td.innerHTML = `<span style="font-size:12.5px;color:#64748b;font-weight:500;font-variant-numeric:tabular-nums;">${value || '-'}</span>`;
                return td;
            }
        },
        { data: 'actualizado', title: 'Actualizado', readOnly: true, width: 90, wordWrap: false,
            renderer(_: any, td: HTMLTableCellElement, __: number, ___: number, ____: string, value: any) {
                td.innerHTML = `<span style="font-size:12.5px;color:#64748b;font-weight:500;font-variant-numeric:tabular-nums;">${value || '-'}</span>`;
                return td;
            }
        }
    ];

    return (
        <div data-testid="accounts-page" className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Cuentas
                    </h1>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto items-center">
                    <button
                        data-testid="accounts-create-button"
                        onClick={() => {
                            router.push("/cuentas/nueva");
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cuenta
                    </button>
                </div>
            </div>

            <DataListToolbar
                searchValue={inputValue}
                onSearchChange={setInputValue}
                searchPlaceholder="Buscar por nombre o NIT…"
                searchTestId="accounts-search"
                filtersOpen={showFilters}
                onFiltersOpenChange={setShowFilters}
                activeFilterCount={(selectedUserId ? 1 : 0) + (webFilter ? 1 : 0) + (currentChannel ? 1 : 0) + (currentSubclass ? 1 : 0) + (currentNivel ? 1 : 0) + (currentStartDate ? 1 : 0) + (currentEndDate ? 1 : 0)}
                quickFilters={<>
                    {hasCoordinatorAccess && <UserPickerFilter selectedUserId={selectedUserId} onUserSelect={handleUserSelect} />}
                    <div className="flex rounded-lg bg-slate-100 p-1">
                        <button onClick={() => setWebFilter(false)} className={cn("rounded-md px-2.5 py-1.5 text-xs font-semibold", !webFilter ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>Todas</button>
                        <button onClick={() => setWebFilter(true)} className={cn("rounded-md px-2.5 py-1.5 text-xs font-semibold", webFilter ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>Web{webFilter && !loading ? ` (${count})` : ''}</button>
                    </div>
                </>}
                sortControl={<select value={`${sortField}:${sortAsc ? 'asc' : 'desc'}`} onChange={(e) => { const [field, direction] = e.target.value.split(':'); setSortField(field); setSortAsc(direction === 'asc'); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-blue-500" aria-label="Ordenar cuentas"><option value="updated_at:desc">Actualizadas</option><option value="nombre:asc">Nombre A–Z</option><option value="potencial_venta:desc">Mayor potencial</option></select>}
                onClear={() => { setInputValue(''); handleUserSelect(null); setWebFilter(false); handleFilterChange({ channelId: null, subclassificationId: null, nivelPremium: null, startDate: null, endDate: null }); }}
                filters={<AccountFilters
                    onFilterChange={handleFilterChange}
                    initialChannelId={currentChannel}
                    initialSubclassId={currentSubclass}
                    initialNivelPremium={currentNivel}
                    initialDates={{ startDate: currentStartDate, endDate: currentEndDate }}
                />}
            />

            {(showCreate || editingAccount) && (
                <div data-testid="accounts-form-panel" className="mb-6 border border-blue-100 rounded-xl shadow-md overflow-hidden animate-in slide-in-from-top-2">
                    <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                        <h3 className="font-semibold text-blue-900">
                            {editingAccount ? `Editando: ${editingAccount.nombre}` : 'Crear Nueva Cuenta'}
                        </h3>
                        <button onClick={() => { setShowCreate(false); setEditingAccount(null); }} className="text-blue-400 hover:text-blue-700 transition-colors">✕</button>
                    </div>
                    <AccountForm
                        key={editingAccount?.id || 'new'}
                        account={editingAccount}
                        onSuccess={handleSuccess}
                        onCancel={() => { setShowCreate(false); setEditingAccount(null); }}
                    />
                </div>
            )}

            {accountToDelete && (
                <AccountDeleteModal
                    account={accountToDelete}
                    onClose={() => setAccountToDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}

            {loading && accounts.length === 0 ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse border border-slate-100" />
                    ))}
                </div>
            ) : accounts.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No se encontraron cuentas</h3>
                    <p className="text-slate-500 mb-4">Prueba ajustando los filtros o crea una nueva.</p>
                </div>
            ) : (
                <div data-testid="accounts-list" className="flex flex-col relative min-h-[450px] transition-all duration-300">
                    {(!loading || accounts.length > 0) && (
                        <div className="flex items-center justify-end mb-3 px-1 z-10">
                            <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                                Total de registros: <strong className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">{count !== undefined && count !== null ? count : accounts.length}</strong>
                            </span>
                        </div>
                    )}
                    {/* VISTA MÓVIL: Tarjetas */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {accounts.map((acc) => (
                            <div 
                                key={acc.id} 
                                onClick={() => handleEdit(acc)}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 active:scale-[0.99] transition-all relative cursor-pointer"
                            >
                                <div className="p-4 border-b border-slate-100 flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm mb-0.5 truncate">
                                            {acc.nombre || "Sin nombre"}
                                        </div>
                                        <div className="text-slate-500 text-xs flex items-center gap-1 truncate">
                                            <MapPin className="w-3 h-3" />
                                            {acc.ciudad || "Sin ciudad"}
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap", 
                                            acc.nivel_premium === 'PREMIUM' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                                        )}>
                                            {acc.nivel_premium || "Regular"}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-slate-50/50 grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                                    <div>
                                        <span className="block text-slate-400 mb-1">Potencial</span>
                                        <span className="font-bold text-slate-800">{formatCurrency(acc.potencial_venta || 0)}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-400 mb-1">Canal / Tipo</span>
                                        <span className="font-medium text-slate-700">{acc.canal_id || "-"} / {acc.subclasificacion_id || "-"}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-slate-400 mb-1">Vendedor</span>
                                        <div className="flex items-center gap-1.5 font-medium text-slate-700 truncate">
                                            <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">
                                                <User className="w-3 h-3" />
                                            </div>
                                            <span className="truncate">{acc.owner_name || "Sin asignar"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* VISTA DESKTOP: Tabla */}
                    <div className="hidden md:block w-full relative z-0 bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm" style={{ minHeight: '400px' }}>
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
                            rowHeights={38}
                            renderAllRows={false}
                            licenseKey="non-commercial-and-evaluation"
                            afterOnCellMouseDown={(event: any, coords: any, td: any) => {
                                if (coords.row === -1) {
                                    const fields: Record<number, string> = { 0: 'nombre', 1: 'ciudad', 2: 'canal_id', 4: 'potencial_venta', 7: 'created_at', 8: 'updated_at' };
                                    if (fields[coords.col]) handleSort(fields[coords.col]);
                                    return;
                                }
                                if (coords.row >= 0) {
                                    const acc = hotData[coords.row]?._original;
                                    if (acc) {
                                        handleEdit(acc);
                                    }
                                }
                            }}
                            afterGetColHeader={(column: number, TH: HTMLTableCellElement) => {
                                const fields: Record<number, string> = { 0: 'nombre', 1: 'ciudad', 2: 'canal_id', 4: 'potencial_venta', 7: 'created_at', 8: 'updated_at' };
                                const labels: Record<number, string> = { 0: 'Cuenta', 1: 'Ubicación', 2: 'Canal', 4: 'Potencial Venta', 7: 'Creación', 8: 'Actualizado' };
                                if (fields[column]) {
                                    TH.style.cursor = 'pointer';
                                    TH.title = 'Clic para ordenar ascendente o descendente';
                                    const header = TH.querySelector('.colHeader');
                                    if (header) header.textContent = `${labels[column]} ${sortField === fields[column] ? (sortAsc ? '↑' : '↓') : '↕'}`;
                                }
                            }}
                            stretchH="all"
                            className="text-sm font-sans"
                        />
                        </div>
                    </div>

                    {hasMore && (
                        <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50/50">
                            <button
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

export default function AccountsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando aplicación...</div>}>
            <AccountsContent />
        </Suspense>
    );
}
