"use client";

import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";

export default function AccountOpportunitiesTab({ accountId }: { accountId: string }) {
    const opportunities = useLiveQuery(
        () => db.opportunities.where('account_id').equals(accountId).toArray(),
        [accountId]
    );

    const phases = useLiveQuery(() => db.phases.toArray());
    const phaseMap = new Map(phases?.map(p => [p.id, p.nombre]));

    if (!opportunities) return <div className="p-4 text-center text-slate-400">Cargando oportunidades...</div>;

    return (
        <div className="pt-4 space-y-3">
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-sm font-bold text-slate-900">Oportunidades Vinculadas</h3>
                <Link href={`/oportunidades/nueva?account_id=${accountId}`}>
                    <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100">
                        <Briefcase className="w-3.5 h-3.5" />
                        Nueva Oportunidad
                    </button>
                </Link>
            </div>

            {opportunities.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No hay oportunidades vinculadas a esta cuenta.</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {opportunities.map(opp => (
                        <Link key={opp.id} href={`/oportunidades/${opp.id}`}>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-400 transition-all cursor-pointer flex justify-between items-center group shadow-sm">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{opp.nombre || "Sin nombre"}</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {phaseMap.get(opp.fase_id) || opp.fase || 'Prospecto'} • {opp.currency_id || 'COP'} {new Intl.NumberFormat().format(opp.amount || 0)}
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
