"use client";

import { useAccountsServer, AccountServer } from "@/lib/hooks/useAccountsServer";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Building, User, Pencil, Medal, Trash2, ArrowUpDown, ChevronUp, ChevronDown, MapPin, Briefcase, DollarSign, Users } from "lucide-react";
import { UserPickerFilter } from "@/components/cuentas/UserPickerFilter";
import { AccountFilters } from "@/components/cuentas/AccountFilters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { cn } from "@/components/ui/utils";
import { AccountDeleteModal } from "@/components/cuentas/AccountDeleteModal";

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
                    {/* Galería de Tarjetas Premium Responsiva */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accounts.map((acc) => (
                            <div 
                                key={acc.id} 
                                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all group relative flex flex-col justify-between min-h-[220px]"
                                data-testid={`accounts-card-${acc.id}`}
                            >
                                <div>
                                    {/* Cabecera de la Tarjeta */}
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <div className={`p-2.5 rounded-xl border shrink-0 ${acc.id_cuenta_principal ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                            <Building className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 justify-end">
                                            {acc.nivel_premium === 'PREMIUM' && (
                                                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 shadow-sm" title="Cliente Premium">
                                                    <Medal className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">PREMIUM</span>
                                                </div>
                                            )}
                                            {acc.nivel_premium === 'DESTACADO' && (
                                                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 shadow-sm" title="Cliente Destacado">
                                                    <Medal className="w-3.5 h-3.5 fill-blue-300 text-blue-400" />
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">DESTACADO</span>
                                                </div>
                                            )}
                                            {acc.nivel_premium === 'ACTIVO' && (
                                                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 shadow-sm" title="Cliente Activo">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">ACTIVO</span>
                                                </div>
                                            )}
                                            {acc.id_cuenta_principal && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                                                    Sucursal
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contenido Interactivo */}
                                    <div onClick={() => handleEdit(acc)} className="cursor-pointer space-y-1">
                                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate" title={acc.nombre}>
                                            {acc.nombre}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600">NIT</span>
                                            <span>{acc.nit || acc.nit_base || "Sin NIT"}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-3 text-[11px] text-slate-600">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Potencial</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(acc.potencial_venta || 0)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Canal / Tipo</span>
                                                <span className="font-semibold text-slate-700 truncate block" title={`${acc.canal_id || "-"} / ${acc.subclasificacion_id || "-"}`}>
                                                    {acc.canal_id || "-"} / {acc.subclasificacion_id || "-"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer de la Tarjeta */}
                                <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-3 text-slate-500 shrink-0">
                                        <span className="flex items-center gap-1 font-semibold" title="Ciudad">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                            {acc.ciudad || "Sin ciudad"}
                                        </span>
                                        <span className="flex items-center gap-1 font-semibold" title="Contactos vinculados">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                            {acc.contact_count || 0}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center gap-1 text-[10px] text-slate-600 max-w-[100px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                            <span className="truncate" title={acc.owner_name || "Sin asignar"}>{acc.owner_name || "Sin asignar"}</span>
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-1 shrink-0">
                                                <button 
                                                    onClick={() => handleEdit(acc)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all"
                                                    title="Editar cuenta"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDelete(e, acc)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all"
                                                    title="Eliminar cuenta"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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
