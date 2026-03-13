"use client";

import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Building, MapPin, ChevronRight, Hash } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface AccountBranchesTabProps {
    accountId: string;
    onSelectAccount?: (account: any) => void;
}

export default function AccountBranchesTab({ accountId, onSelectAccount }: AccountBranchesTabProps) {
    // Buscar cuentas que tengan id_cuenta_principal igual al accountId actual
    const branches = useLiveQuery(
        () => db.accounts.where('id_cuenta_principal').equals(accountId).toArray(),
        [accountId]
    );

    if (!branches) {
        return (
            <div className="p-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-8 bg-slate-200 rounded-full mb-2"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
                    <div className="h-3 w-48 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-4 space-y-4">
            <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-600 p-1.5 rounded-lg">
                        <Building className="w-4 h-4" />
                    </span>
                    Sucursales Asociadas ({branches.length})
                </h3>
            </div>

            {branches.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-slate-500">No se encontraron sucursales vinculadas.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {branches.map(branch => (
                        <div
                            key={branch.id}
                            onClick={() => onSelectAccount?.(branch)}
                            className={cn(
                                "group bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all duration-200",
                                onSelectAccount ? "hover:border-purple-400 hover:shadow-md cursor-pointer" : ""
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 flex-1">
                                    <h4 className="font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                                        {branch.nombre}
                                    </h4>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-mono">{branch.nit_base || branch.nit || 'Sin NIT'}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{branch.ciudad || 'Ciudad no definida'}</span>
                                        </div>
                                    </div>
                                </div>

                                {onSelectAccount && (
                                    <div className="bg-slate-50 p-1.5 rounded-lg group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
