"use client";

import { useAccountsServer, AccountServer } from "@/lib/hooks/useAccountsServer";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Plus, Search, Building, Users, Pencil } from "lucide-react";

function AccountsContent() {
    const searchParams = useSearchParams();
    const {
        data: accounts,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        refresh
    } = useAccountsServer({ pageSize: 20 });

    const [showCreate, setShowCreate] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [inputValue, setInputValue] = useState("");

    // Initialize search from URL
    useEffect(() => {
        const query = searchParams.get('search');
        if (query) {
            setInputValue(query);
            setSearchTerm(query);
        }
    }, [searchParams, setSearchTerm]);

    // Deep linking for edit (requires fetching specific ID if not in list? 
    // Implementation for now just checks loaded list or ignores deep link if not loaded)
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && accounts.length > 0) {
            const acc = accounts.find(a => a.id === id);
            if (acc) {
                setEditingAccount(acc);
                setShowCreate(false);
            }
        }
    }, [searchParams, accounts]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue, setSearchTerm]);

    const handleEdit = (acc: any) => {
        setEditingAccount(acc);
        setShowCreate(false);
    };

    const handleSuccess = () => {
        setShowCreate(false);
        setEditingAccount(null);
        refresh(); // Refresh list to show new/updated account
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-900">Cuentas</h1>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                            placeholder="Buscar por nombre o NIT..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            setShowCreate(true);
                            setEditingAccount(null);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cuenta
                    </button>
                </div>
            </div>

            {(showCreate || editingAccount) && (
                <div className="mb-6 border border-blue-100 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-top-2">
                    <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                        <h3 className="font-semibold text-blue-900">
                            {editingAccount ? `Editando: ${editingAccount.nombre}` : 'Crear Nueva Cuenta'}
                        </h3>
                        <button onClick={() => {
                            setShowCreate(false);
                            setEditingAccount(null);
                        }} className="text-blue-400 hover:text-blue-700">✕</button>
                    </div>
                    <AccountForm
                        account={editingAccount}
                        onSuccess={handleSuccess}
                        onCancel={() => {
                            setShowCreate(false);
                            setEditingAccount(null);
                        }}
                    />
                </div>
            )}

            {loading && accounts.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />
                    ))}
                </div>
            ) : accounts.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No hay cuentas</h3>
                    <p className="text-slate-500 mb-4">Comienza creando tu primera cuenta de cliente.</p>
                    <button onClick={() => setShowCreate(true)} className="text-blue-600 font-medium hover:underline">Crear cuenta ahora</button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {accounts.map(acc => (
                            <div key={acc.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all group relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`p-2 rounded-lg ${acc.id_cuenta_principal ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                        <Building className="w-5 h-5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {acc.id_cuenta_principal && (
                                            <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                                Sucursal
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleEdit(acc)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div onClick={() => handleEdit(acc)} className="cursor-pointer">
                                    <h3 className="font-bold text-slate-800 truncate" title={acc.nombre}>{acc.nombre}</h3>
                                    <p className="text-sm font-mono text-slate-500 mb-3">{acc.nit || acc.nit_base}</p>

                                    <div className="flex items-center text-xs text-slate-400 gap-3 border-t pt-3 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" /> 0 Contactos
                                        </span>
                                        <span>
                                            {acc.ciudad || "Sin ciudad"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {hasMore && (
                        <div className="pt-6 flex justify-center pb-8">
                            <button
                                onClick={() => loadMore()}
                                disabled={loading}
                                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loading ? 'Cargando...' : 'Cargar más cuentas'}
                            </button>
                        </div>
                    )}
                </>
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
