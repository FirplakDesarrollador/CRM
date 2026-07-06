"use client";

import { useAccountsServer, AccountServer } from "@/lib/hooks/useAccountsServer";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Building, User, Pencil, Medal, Trash2, ArrowUpDown, ChevronUp, ChevronDown, MapPin, Briefcase, DollarSign } from "lucide-react";
import { UserPickerFilter } from "@/components/cuentas/UserPickerFilter";
import { AccountFilters } from "@/components/cuentas/AccountFilters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { cn } from "@/components/ui/utils";
import { AccountDeleteModal } from "@/components/cuentas/AccountDeleteModal";
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
    const [accountToDelete, setAccountToDelete] = useState<any>(null);
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
        return searchParams.get('channel') || null;
    });

    const [currentNivel, setCurrentNivel] = useState<string | null>(() => {
        return searchParams.get('nivel') || null;
    });

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
        setCurrentNivel(nivelPremium);
    }, [setChannelFilter, setSubclassificationFilter, setNivelPremiumFilter, setStartDate, setEndDate]);

    const handleUserSelect = useCallback((userId: string | null) => {
        setSelectedUserId(userId);
        setAssignedUserId(userId);
    }, [setAssignedUserId]);

    // Initial Sync from URL
    useEffect(() => {
        const query = searchParams.get('search') || '';
        const userQuery = searchParams.get('user') || null;
        if (query) setSearchTerm(query);
        if (userQuery) setAssignedUserId(userQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Deep linking: Automatically fetch and open account by ID from URL
    useEffect(() => {
        const id = searchParams.get('id');
        if (!id || editingAccount?.id === id) return;

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
    }, [searchParams, accounts, editingAccount?.id]);

    // Sync to URL & SessionStorage
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);

            const params = new URLSearchParams(Array.from(searchParams.entries()));
            if (inputValue) params.set('search', inputValue); else params.delete('search');
            if (selectedUserId) params.set('user', selectedUserId); else params.delete('user');
            if (currentChannel) params.set('channel', currentChannel); else params.delete('channel');
            if (currentNivel) params.set('nivel', currentNivel); else params.delete('nivel');

            if (editingAccount?.id) params.set('id', editingAccount.id); else params.delete('id');

            const queryString = params.toString();
            if (queryString === searchParams.toString()) return;

            if (queryString) sessionStorage.setItem('crm_cuentas_state', queryString);
            else if (searchParams.toString() !== '') sessionStorage.removeItem('crm_cuentas_state');

            const queryLink = queryString ? `?${queryString}` : window.location.pathname;
            router.replace(queryLink.startsWith('?') ? `${window.location.pathname}${queryLink}` : queryLink, { scroll: false });
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, selectedUserId, currentChannel, currentNivel, editingAccount?.id, searchParams, setSearchTerm, router]);

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
        { data: 'nombre', title: 'Cuenta', type: 'text', readOnly: true },
        { data: 'ciudad', title: 'Ubicación', type: 'text', readOnly: true },
        { data: 'canal_id', title: 'Canal', type: 'text', readOnly: true },
        { data: 'tipo', title: 'Tipo', type: 'text', readOnly: true },
        { 
            data: 'potencial_venta', 
            title: 'Potencial Venta', 
            type: 'numeric',
            numericFormat: { pattern: '$ 0,0', culture: 'es-CO' },
            readOnly: true
        },
        { data: 'vendedor', title: 'Vendedor', type: 'text', readOnly: true },
        { data: 'nivel', title: 'Nivel', type: 'text', readOnly: true },
        { data: 'creacion', title: 'Creación', type: 'text', readOnly: true },
        { data: 'actualizado', title: 'Actualizado', type: 'text', readOnly: true }
    ];

    if (isAdmin) {
        hotColumns.unshift({
            data: 'acciones',
            title: 'Acciones',
            renderer: function (instance: any, td: HTMLTableCellElement, row: number, col: number, prop: string, value: any, cellProperties: any) {
                td.innerHTML = `
                    <div style="text-align: center; white-space: nowrap;">
                        <button class="edit-action-btn" title="Editar" style="cursor:pointer; color:#2563eb; background:none; border:none; padding:0 4px; margin:0; display:inline-block; vertical-align:middle;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button class="delete-action-btn" title="Eliminar" style="cursor:pointer; color:#dc2626; background:none; border:none; padding:0 4px; margin:0; display:inline-block; vertical-align:middle;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                    </div>
                `;
                td.className = "htCenter htMiddle";
                return td;
            },
            readOnly: true,
            width: 80
        } as any);
    }

    return (
        <div data-testid="accounts-page" className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Cuentas
                        {count !== undefined && count !== null && !loading && (
                            <span className="ml-2 text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full align-middle">
                                {count}
                            </span>
                        )}
                    </h1>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto items-center">
                    {hasCoordinatorAccess && (
                        <UserPickerFilter
                            selectedUserId={selectedUserId}
                            onUserSelect={handleUserSelect}
                        />
                    )}

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            data-testid="accounts-search"
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="Buscar por nombre o NIT..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                    </div>
                    <button
                        data-testid="accounts-create-button"
                        onClick={() => {
                            setShowCreate(true);
                            setEditingAccount(null);
                            document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cuenta
                    </button>
                </div>
            </div>

            <div className="flex gap-4 border-b border-slate-200 mt-2 mb-4">
                <button
                    onClick={() => setWebFilter(false)}
                    className={cn(
                        "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                        !webFilter ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                    )}
                >
                    Todas
                </button>
                <button
                    onClick={() => setWebFilter(true)}
                    className={cn(
                        "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                        webFilter ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                    )}
                >
                    Cuentas desde página {webFilter && !loading && `(${count})`}
                </button>
            </div>

            <div className="pb-2 border-b border-slate-200">
                <AccountFilters
                    onFilterChange={handleFilterChange}
                    initialChannelId={currentChannel}
                    initialNivelPremium={currentNivel}
                />
            </div>

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
                    {/* VISTA MÓVIL: Tarjetas */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {accounts.map((acc) => (
                            <div key={acc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 active:scale-[0.99] transition-all relative">
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
                                
                                {isAdmin && (
                                    <div className="flex divide-x divide-slate-100 border-t border-slate-100 bg-white">
                                        <button 
                                            onClick={() => handleEdit(acc)}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-blue-600 hover:bg-blue-50 font-medium text-xs transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            Editar
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (window.confirm(`¿Estás seguro de que deseas eliminar la cuenta "${acc.nombre}"?`)) {
                                                    confirmDelete(acc.id);
                                                }
                                            }}
                                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-rose-600 hover:bg-rose-50 font-medium text-xs transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* VISTA DESKTOP: Tabla */}
                    <div className="hidden md:block w-full relative z-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" style={{ minHeight: '400px' }}>
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
                            afterOnCellMouseDown={(event, coords, td) => {
                                if (coords.row >= 0) {
                                    const acc = hotData[coords.row]._original;
                                    const target = event.target as HTMLElement;
                                    
                                    if (target.closest('.delete-action-btn')) {
                                        setAccountToDelete(acc);
                                        return;
                                    }
                                    
                                    if (target.closest('.edit-action-btn')) {
                                        handleEdit(acc);
                                        return;
                                    }
                                    
                                    handleEdit(acc);
                                }
                            }}
                            stretchH="all"
                            className="text-sm font-sans"
                        />
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
