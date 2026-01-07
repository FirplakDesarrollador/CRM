"use client";

import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useState } from "react";
import { Plus, Search, Filter, Briefcase } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { useSyncStore } from "@/lib/store/sync";

const CURRENT_USER_ID = "user-123"; // Mock

export default function OpportunitiesPage() {
    const { opportunities, generateMockData } = useOpportunities();
    const { userRole, setUserRole } = useSyncStore();
    const [tab, setTab] = useState<'mine' | 'collab' | 'team'>('mine');

    // Filter Logic
    const filtered = (opportunities || []).filter(opp => {
        if (tab === 'team') {
            if (userRole === 'ADMIN') return true;
            return false;
        }
        if (tab === 'collab') return false; // Mock
        // 'mine'
        return opp.owner_user_id === CURRENT_USER_ID || !opp.owner_user_id;
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Oportunidades</h1>
                    <span
                        className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-slate-200"
                        onClick={() => setUserRole(userRole === 'ADMIN' ? 'SALES' : 'ADMIN')}
                    >
                        Rol: {userRole} (Click cambiar)
                    </span>
                </div>
                <Link
                    href="/oportunidades/nueva"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 w-full md:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Oportunidad
                </Link>
            </div>

            {/* Tabs & Filters */}
            <div className="flex flex-col md:flex-row gap-4 border-b border-slate-200 pb-2">
                <div className="flex space-x-4">
                    <button
                        onClick={() => setTab('mine')}
                        className={cn(
                            "pb-2 text-sm font-medium border-b-2 transition-colors",
                            tab === 'mine' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                        )}
                    >
                        Mis Oportunidades
                    </button>
                    <button
                        onClick={() => setTab('collab')}
                        className={cn(
                            "pb-2 text-sm font-medium border-b-2 transition-colors",
                            tab === 'collab' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                        )}
                    >
                        En las que colaboro
                    </button>

                    {userRole === 'ADMIN' && (
                        <button
                            onClick={() => setTab('team')}
                            className={cn(
                                "pb-2 text-sm font-medium border-b-2 transition-colors",
                                tab === 'team' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            Todas (Equipo)
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No hay oportunidades aquí</h3>
                    <p className="text-slate-500 mb-4">Crea una nueva oportunidad para comenzar el seguimiento.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map(opp => (
                        <Link key={opp.id} href={`/oportunidades/${opp.id}`}>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 transition-all cursor-pointer flex justify-between items-center group">
                                <div>
                                    <h3 className="font-bold text-slate-800">{opp.nombre || "Sin nombre"}</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {opp.fase || 'Prospecto'} • {opp.currency_id || 'COP'} {new Intl.NumberFormat().format(opp.amount || 0)}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
