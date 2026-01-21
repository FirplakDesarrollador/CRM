"use client";

import React from "react";
import { Building2, User, Phone, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";

interface RecentAccountsProps {
    accounts: any[];
    isLoading?: boolean;
}

export const RecentAccounts = ({ accounts, isLoading }: RecentAccountsProps) => {
    if (isLoading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-slate-50 rounded-xl"></div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800">Cuentas Recientes</h3>
                <Link href="/cuentas" className="text-xs font-bold text-[#254153] hover:underline flex items-center gap-1">
                    Ver Todo <ArrowRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="space-y-3">
                {accounts.length > 0 ? accounts.map(account => (
                    <Link
                        key={account.id}
                        href={`/cuentas/${account.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#254153] group-hover:bg-white group-hover:shadow-sm transition-all">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{account.nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                                <span className="bg-slate-100 px-2 py-0.5 rounded uppercase">{account.tipo_cliente_id || 'Cliente'}</span>
                                <span className="truncate">{account.ciudad || 'Colombia'}</span>
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#254153] group-hover:translate-x-1 transition-all" />
                    </Link>
                )) : (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm">No has registrado cuentas aún</p>
                    </div>
                )}
            </div>
        </div>
    );
};
