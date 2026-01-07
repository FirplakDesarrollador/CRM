"use client";

import { useAccounts } from "@/lib/hooks/useAccounts";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useState } from "react";
import { Plus, Search, Building, Users } from "lucide-react";
import { Card } from "@/layout/Card"; // Using generic divs for now if Card not avail

export default function AccountsPage() {
    const { accounts, isLoading } = useAccounts();
    const [showCreate, setShowCreate] = useState(false);
    const [search, setSearch] = useState("");

    const filtered = accounts.filter(a =>
        a.nombre.toLowerCase().includes(search.toLowerCase()) ||
        a.nit?.includes(search)
    );

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
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cuenta
                    </button>
                </div>
            </div>

            {showCreate && (
                <div className="mb-6 border border-blue-100 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-top-2">
                    <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                        <h3 className="font-semibold text-blue-900">Crear Nueva Cuenta</h3>
                        <button onClick={() => setShowCreate(false)} className="text-blue-400 hover:text-blue-700">✕</button>
                    </div>
                    <AccountForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
                </div>
            )}

            {isLoading ? (
                <div className="p-8 text-center text-slate-400">Cargando cuentas...</div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No hay cuentas</h3>
                    <p className="text-slate-500 mb-4">Comienza creando tu primera cuenta de cliente.</p>
                    <button onClick={() => setShowCreate(true)} className="text-blue-600 font-medium hover:underline">Crear cuenta ahora</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(acc => (
                        <div key={acc.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors group cursor-pointer relative">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2 rounded-lg ${acc.id_cuenta_principal ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                    <Building className="w-5 h-5" />
                                </div>
                                {acc.id_cuenta_principal && (
                                    <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                        Sucursal
                                    </span>
                                )}
                            </div>

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
                    ))}
                </div>
            )}
        </div>
    );
}
