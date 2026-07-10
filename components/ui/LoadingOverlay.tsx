"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";
import { useEffect, useState } from "react";

/**
 * Premium Global Loading Indicator.
 * Displays a subtle, animated progress bar at the very top of the screen.
 * Non-blocking: allows the user to continue navigating while data is being fetched/synced.
 */
export function LoadingOverlay() {
    const isSyncing = useSyncStore((state) => state.isSyncing);
    const isProcessing = useSyncStore((state) => state.isProcessing);
    const isLoadingData = useSyncStore((state) => state.isLoadingData);
    
    const [show, setShow] = useState(false);

    // Debounce to avoid flickering on micro-loads
    useEffect(() => {
        const active = isSyncing || isProcessing || isLoadingData;
        if (active) {
            const timer = setTimeout(() => setShow(true), 100);
            return () => clearTimeout(timer);
        } else {
            setShow(false);
        }
    }, [isSyncing, isProcessing, isLoadingData]);

    if (!show) return null;

    return (
        <div 
            data-testid="loading-indicator" 
            className="fixed top-0 left-0 right-0 z-9999 h-[3px] bg-slate-100/10 overflow-hidden pointer-events-none"
        >
            <div
                className="h-full bg-linear-to-r from-blue-500 via-sky-400 to-blue-600 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-premium-loading"
                style={{ width: '100%' }}
            />
            <style jsx>{`
                @keyframes premium-loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(-10%); }
                    100% { transform: translateX(0); }
                }
                .animate-premium-loading {
                    animation: premium-loading 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
                }
            `}</style>
        </div>
    );
}
