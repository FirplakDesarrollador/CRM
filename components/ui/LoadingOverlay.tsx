"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";
import { Loader2 } from "lucide-react";
import { cn } from "@/components/ui/utils";

export function LoadingOverlay() {
    const isProcessing = useSyncStore((state) => state.isProcessing);

    if (!isProcessing) return null;

    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-300">
            <div className="bg-white/90 dark:bg-slate-900/90 p-8 rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center gap-4 scale-in-center overflow-hidden relative group">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />

                <div className="relative">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    <div className="absolute inset-0 w-12 h-12 border-4 border-blue-600/20 rounded-full" />
                </div>

                <div className="text-center relative">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Procesando
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Por favor espera un momento...
                    </p>
                </div>

                {/* Animated progress bar (decorative) */}
                <div className="w-32 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-blue-600 animate-[loading_1.5s_infinite_linear]" style={{ width: '40%' }} />
                </div>
            </div>

            <style jsx>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
                .scale-in-center {
                    animation: scale-in-center 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
                }
                @keyframes scale-in-center {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
