"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useEffect, useState } from "react";

export function SyncStatus() {
    const { isSyncing, pendingCount, lastSyncTime, error } = useSyncStore();
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="px-3 py-4 space-y-3">
            <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2">
                    {isOnline ? (
                        <Cloud className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <CloudOff className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {isOnline ? "En Línea" : "Sin Conexión"}
                    </span>
                </div>

                {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                ) : error ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                )}
            </div>

            {pendingCount > 0 && (
                <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-[10px] text-blue-200">Pendientes</span>
                    <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {pendingCount}
                    </span>
                </div>
            )}

            {error && (
                <div className="text-[9px] text-red-400 bg-red-900/20 p-2 rounded border border-red-800/30 wrap-break-word">
                    Error: {error}
                </div>
            )}

            {lastSyncTime && !error && (
                <div className="text-[9px] text-slate-500 text-center">
                    Sincronizado: {new Date(lastSyncTime).toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}
