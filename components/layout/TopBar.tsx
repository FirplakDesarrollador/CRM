"use client";

import { useSyncStore } from "@/lib/store/sync";
import { cn } from "@/components/ui/utils";
import { Bell, Search, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export function TopBar() {
    const { isSyncing, pendingChanges, syncError } = useSyncStore();

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30">
            {/* Mobile Title (Sidebar hidden) */}
            <h1 className="md:hidden text-lg font-bold text-slate-800">CRM FIRPLAK</h1>

            {/* Desktop Search (Placeholder) */}
            <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2 w-96">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                    type="text"
                    placeholder="Buscar cuentas, oportunidades..."
                    className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-700"
                />
            </div>

            <div className="flex items-center gap-4">
                {/* Sync Status Badge */}
                <div className="flex items-center gap-2 text-xs font-medium">
                    {isSyncing ? (
                        <span className="flex items-center text-blue-600 gap-1 bg-blue-50 px-2 py-1 rounded-full">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Sincronizando...
                        </span>
                    ) : syncError ? (
                        <span className="flex items-center text-red-600 gap-1 bg-red-50 px-2 py-1 rounded-full cursor-pointer" title={syncError}>
                            <AlertCircle className="w-3 h-3" />
                            Error
                        </span>
                    ) : pendingChanges > 0 ? (
                        <span className="flex items-center text-orange-600 gap-1 bg-orange-50 px-2 py-1 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            {pendingChanges} Pendientes
                        </span>
                    ) : (
                        <span className="hidden md:flex items-center text-green-600 gap-1 bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Al día
                        </span>
                    )}
                </div>

                <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>

                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                    JD
                </div>
            </div>
        </header>
    );
}
