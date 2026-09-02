"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { memo, useEffect, useState } from "react";
import { resolveSaveStatus } from "@/lib/sync-runtime";

export interface SyncStatusProps {
    isCollapsed?: boolean;
}

export const SyncStatus = memo(function SyncStatus({ isCollapsed }: SyncStatusProps) {
    const isSyncing = useSyncStore(state => state.isSyncing);
    const pendingCount = useSyncStore(state => state.pendingCount);
    const attentionCount = useSyncStore(state => state.attentionCount);
    const lastSyncTime = useSyncStore(state => state.lastSyncTime);
    const error = useSyncStore(state => state.error);
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

    const saveStatus = resolveSaveStatus({ pendingCount, attentionCount, error });

    return (
        <div className={cn("py-4 flex flex-col items-center", isCollapsed ? "px-0" : "px-3 space-y-3")}>
            <div className={cn("flex items-center justify-between group", !isCollapsed && "w-full")}>
                <div className="flex items-center gap-2">
                    {isOnline ? (
                        <Cloud className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <CloudOff className="w-4 h-4 text-amber-400" />
                    )}
                    {!isCollapsed && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {isOnline ? "En Línea" : "Sin Conexión"}
                        </span>
                    )}
                </div>

                {!isCollapsed && (
                    isSyncing && saveStatus.kind === 'pending' ? (
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    ) : saveStatus.kind === 'attention' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                    )
                )}
            </div>

            {!isCollapsed && (
                <div className={cn(
                    "w-full rounded-lg border px-2 py-1.5 text-[10px] font-semibold",
                    saveStatus.kind === 'saved' && "border-emerald-800/30 bg-emerald-900/20 text-emerald-300",
                    saveStatus.kind === 'pending' && "border-amber-700/40 bg-amber-900/20 text-amber-200",
                    saveStatus.kind === 'attention' && "border-red-800/40 bg-red-900/20 text-red-300"
                )}>
                    {saveStatus.label}
                </div>
            )}

            {!isCollapsed && pendingCount > 0 && (
                <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg p-2 flex items-center justify-between w-full">
                    <span className="text-[10px] text-blue-200">Pendientes</span>
                    <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {pendingCount}
                    </span>
                </div>
            )}

            {!isCollapsed && error && (
                <div className="text-[9px] text-red-400 bg-red-900/20 p-2 rounded border border-red-800/30 wrap-break-word w-full">
                    Error: {error}
                </div>
            )}

            {!isCollapsed && lastSyncTime && !error && (
                <div className="text-[9px] text-slate-500 text-center">
                    Sincronizado: {new Date(lastSyncTime).toLocaleTimeString()}
                </div>
            )}
        </div>
    );
});
