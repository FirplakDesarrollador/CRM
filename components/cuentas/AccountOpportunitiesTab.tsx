"use client";

import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { Briefcase, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/components/ui/utils";

type StatusFilter = 'all' | 'open' | 'won' | 'lost';

export default function AccountOpportunitiesTab({ accountId }: { accountId: string }) {
    const [currentStatus, setCurrentStatus] = useState<StatusFilter>('open');
    
    const { 
        data: opportunities, 
        loading,
        setAccountIdFilter,
        setStatusFilter,
        setUserFilter 
    } = useOpportunitiesServer({ pageSize: 100 });

    useEffect(() => {
        setAccountIdFilter(accountId);
        setUserFilter('all'); // Asegurar que vemos todas las oportunidades de la cuenta, no solo las propias
    }, [accountId, setAccountIdFilter, setUserFilter]);

    useEffect(() => {
        setStatusFilter(currentStatus);
    }, [currentStatus, setStatusFilter]);

    const phases = useLiveQuery(() => db.phases.toArray());
    const phaseMap = new Map(phases?.map(p => [p.id, p.nombre]));

    if (loading && !opportunities?.length) return <div className="p-4 text-center text-slate-400">Cargando oportunidades...</div>;

    return (
        <div className="pt-2 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2 px-1">
                <div>
                    <h3 className="text-sm font-bold text-slate-900">Oportunidades Vinculadas</h3>
                    <p className="text-[10px] text-slate-500">Listado de negocios asociados a esta cuenta</p>
                </div>
                
                <Link href={`/oportunidades/nueva?account_id=${accountId}`}>
                    <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100 shadow-sm">
                        <Briefcase className="w-3.5 h-3.5" />
                        Nueva Oportunidad
                    </button>
                </Link>
            </div>

            {/* Filtro de Estado */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {[
                    { id: 'open', label: 'Abiertas' },
                    { id: 'won', label: 'Ganadas' },
                    { id: 'lost', label: 'Perdidas' },
                    { id: 'all', label: 'Todas' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setCurrentStatus(tab.id as StatusFilter)}
                        className={cn(
                            "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                            currentStatus === tab.id 
                                ? "bg-white text-blue-600 shadow-sm" 
                                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {opportunities && opportunities.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No se encontraron oportunidades {currentStatus !== 'all' ? currentStatus === 'open' ? 'abiertas' : currentStatus === 'won' ? 'ganadas' : 'perdidas' : ''} para esta cuenta.</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {opportunities?.map(opp => (
                        <Link key={opp.id} href={`/oportunidades/${opp.id}`}>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-400 transition-all cursor-pointer flex justify-between items-center group shadow-sm">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{opp.nombre || "Sin nombre"}</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        <span className={cn(
                                            "font-semibold",
                                            opp.fase_data?.nombre?.toLowerCase().includes('ganada') ? "text-emerald-600" : 
                                            opp.fase_data?.nombre?.toLowerCase().includes('perdida') ? "text-red-600" : "text-blue-600"
                                        )}>
                                            {opp.fase_data?.nombre || phaseMap.get(Number(opp.fase_id)) || 'Prospecto'}
                                        </span>
                                        <span className="mx-1.5 text-slate-300">•</span>
                                        {opp.currency_id || 'COP'} {new Intl.NumberFormat().format(opp.amount || 0)}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
