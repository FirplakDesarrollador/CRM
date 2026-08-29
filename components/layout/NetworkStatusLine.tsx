"use client";

import React, { useState } from "react";
import { useNetworkQuality, resolveStatusLineVisuals } from "@/lib/hooks/useNetworkQuality";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/components/ui/utils";

export function NetworkStatusLine() {
    const { status, latency, effectiveType, isChecking, checkConnection } = useNetworkQuality();
    const isSyncing = useSyncStore((state) => state.isSyncing);
    const isLoadingData = useSyncStore((state) => state.isLoadingData);
    const [showTooltip, setShowTooltip] = useState(false);

    const isBackgroundLoading = isSyncing || isLoadingData || isChecking;
    const visuals = resolveStatusLineVisuals(status, {
        latency,
        isSyncing: isBackgroundLoading,
    });

    const icon = status === 'offline' ? (
        <WifiOff className="w-3.5 h-3.5 text-rose-400" />
    ) : status === 'unstable' ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
    ) : isBackgroundLoading ? (
        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
    ) : (
        <Wifi className="w-3.5 h-3.5 text-sky-400" />
    );

    return (
        <div
            className="relative w-full z-20 group cursor-pointer"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => checkConnection()}
            title="Haz clic para comprobar el estado de conexión"
        >
            {/* Luminous Glow Line */}
            <div
                className={cn(
                    "w-full h-[2.5px] transition-all duration-700 ease-in-out",
                    visuals.bgClass,
                    visuals.pulseClass
                )}
                style={visuals.glowStyle}
            />

            {/* Subtle floating badge on hover */}
            <div
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 top-2 z-50 pointer-events-auto transition-all duration-200 ease-out",
                    showTooltip ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
                )}
            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium shadow-xl border border-slate-700/60 whitespace-nowrap">
                    {icon}
                    <span className="font-semibold text-slate-100">{visuals.label}</span>
                    <span className="text-slate-400 text-[11px]">• {visuals.description}</span>
                    {effectiveType && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {effectiveType}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            checkConnection();
                        }}
                        className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        title="Verificar ahora"
                    >
                        <RefreshCw className={cn("w-3 h-3", isChecking && "animate-spin text-sky-400")} />
                    </button>
                </div>
            </div>
        </div>
    );
}
