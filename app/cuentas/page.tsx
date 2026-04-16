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
        sortField,
        sortAsc,
        refresh
    } = useAccountsServer({ pageSize: 20 });

    const [showCreate, setShowCreate] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
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

    const handleDelete = async (e: React.MouseEvent, acc: any) => {
        e.stopPropagation();
        if (!window.confirm(`¿Estás seguro de eliminar la cuenta "${acc.nombre}"?`)) return;
        try {
            await deleteAccount(acc.id);
            refresh();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div data-testid="accounts-page" className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-900">Cuentas</h1>

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
                <div data-testid="accounts-list" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th onClick={() => handleSort('nombre')} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100/50 transition-colors">
                                        <div className="flex items-center">Cuenta <SortIcon field="nombre" /></div>
                                    </th>
                                    <th onClick={() => handleSort('ciudad')} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100/50 transition-colors">
                                        <div className="flex items-center">Ubicación <SortIcon field="ciudad" /></div>
                                    </th>
                                    <th onClick={() => handleSort('canal_id')} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-100/50 transition-colors">
                                        <div className="flex items-center">Canal / Tipo <SortIcon field="canal_id" /></div>
                                    </th>
                                    <th onClick={() => handleSort('potencial_venta')} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right cursor-pointer group hover:bg-slate-100/50 transition-colors">
                                        <div className="flex items-center justify-end">Potencial Venta <SortIcon field="potencial_venta" /></div>
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vendedor</th>
                                    <th onClick={() => handleSort('nivel_premium')} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer group hover:bg-slate-100/50 transition-colors">
                                        <div className="flex items-center justify-center">Nivel <SortIcon field="nivel_premium" /></div>
                                    </th>
                                    <th onClick={() => handleSort('updated_at')} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center cursor-pointer group hover:bg-slate-100/50 transition-colors">
                                        <div className="flex items-center justify-center">Actualizado <SortIcon field="updated_at" /></div>
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {accounts.map(acc => (
                                    <tr 
                                        key={acc.id} 
                                        onClick={() => handleEdit(acc)}
                                        className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate block max-w-[200px]" title={acc.nombre}>
                                                {acc.nombre}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                <MapPin className="w-3 h-3 text-slate-400" />
                                                <span className="text-xs text-slate-600">{acc.ciudad || "Sin ciudad"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Briefcase className="w-3 h-3 text-slate-400" />
                                                    <span className="text-xs font-medium text-slate-700">{acc.canal_id || "-"}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                                                    {acc.subclasificacion_id ? `Tipo: ${acc.subclasificacion_id}` : ""}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    (acc.potencial_venta || 0) > 0 ? "text-emerald-600" : "text-slate-400"
                                                )}>
                                                    {formatCurrency(acc.potencial_venta || 0)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                                                    Consolidado
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span className="text-xs text-slate-600 truncate max-w-[100px]" title={acc.owner_name || ""}>
                                                    {acc.owner_name || "Sin asignar"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {acc.nivel_premium ? (
                                                <div className={cn(
                                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-sm",
                                                    acc.nivel_premium === 'ORO' ? "bg-amber-50 text-amber-600 border-amber-200" :
                                                    acc.nivel_premium === 'PLATA' ? "bg-slate-50 text-slate-600 border-slate-200" :
                                                    "bg-orange-50 text-orange-600 border-orange-200"
                                                )}>
                                                    <Medal className={cn("w-3 h-3", acc.nivel_premium === 'ORO' ? "fill-amber-400" : acc.nivel_premium === 'PLATA' ? "fill-slate-300" : "fill-orange-400")} />
                                                    <span className="text-[10px] font-bold">{acc.nivel_premium}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs text-slate-500">
                                                {acc.updated_at ? new Date(acc.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : "-"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(acc); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {isAdmin && (
                                                    <button onClick={(e) => handleDelete(e, acc)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
