"use client";

import React, { useState } from "react";
import { useNetworkQuality, NetworkStatus } from "@/lib/hooks/useNetworkQuality";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/components/ui/utils";

export function NetworkStatusLine() {
    const { status, latency, effectiveType, isChecking, checkConnection } = useNetworkQuality();
    const [showTooltip, setShowTooltip] = useState(false);

    const config: Record<
        NetworkStatus,
        {
            label: string;
            description: string;
            bgClass: string;
            glowStyle: React.CSSProperties;
            pulseClass: string;
            badgeColor: string;
            icon: React.ReactNode;
        }
    > = {
        online: {
            label: "En línea",
            description: latency !== null ? `Conexión óptima (${latency}ms)` : "Conexión activa",
            bgClass: "bg-linear-to-r from-[#254153] via-[#0284c7] to-[#38bdf8]",
            glowStyle: {
                boxShadow: "0 0 8px rgba(2, 132, 199, 0.6), 0 0 16px rgba(37, 65, 83, 0.3)",
            },
            pulseClass: "",
            badgeColor: "text-sky-400 bg-sky-950/30 border-sky-500/30",
            icon: <Wifi className="w-3.5 h-3.5 text-sky-400" />,
        },
        unstable: {
            label: "Conexión inestable",
            description: latency !== null ? `Latencia alta o red lenta (${latency}ms)` : "Red inestable o lenta",
            bgClass: "bg-linear-to-r from-[#d97706] via-[#f59e0b] to-[#fde047]",
            glowStyle: {
                boxShadow: "0 0 10px rgba(245, 158, 11, 0.75), 0 0 20px rgba(217, 119, 6, 0.4)",
            },
            pulseClass: "animate-pulse",
            badgeColor: "text-amber-400 bg-amber-950/30 border-amber-500/30",
            icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        },
        offline: {
            label: "Sin conexión",
            description: "Modo offline (cambios guardados localmente)",
            bgClass: "bg-linear-to-r from-[#991b1b] via-[#ef4444] to-[#f87171]",
            glowStyle: {
                boxShadow: "0 0 12px rgba(239, 68, 68, 0.85), 0 0 24px rgba(185, 28, 28, 0.5)",
            },
            pulseClass: "animate-pulse",
            badgeColor: "text-rose-400 bg-rose-950/30 border-rose-500/30",
            icon: <WifiOff className="w-3.5 h-3.5 text-rose-400" />,
        },
    };

    const current = config[status];

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
                    current.bgClass,
                    current.pulseClass
                )}
                style={current.glowStyle}
            />

            {/* Subtle floating badge on hover */}
            <div
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 top-2 z-50 pointer-events-auto transition-all duration-200 ease-out",
                    showTooltip ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
                )}
            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium shadow-xl border border-slate-700/60 whitespace-nowrap">
                    {current.icon}
                    <span className="font-semibold text-slate-100">{current.label}</span>
                    <span className="text-slate-400 text-[11px]">• {current.description}</span>
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
