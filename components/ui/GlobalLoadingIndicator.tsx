"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";
import { useEffect, useState } from "react";

/**
 * Global Loading Indicator (formerly GlobalLoadingIndicator).
 * Displays a subtle, animated progress bar at the very top of the screen.
 */
export function GlobalLoadingIndicator() {
    const isSyncing = useSyncStore((state) => state.isSyncing);
    const isProcessing = useSyncStore((state) => state.isProcessing);
    const isLoadingData = useSyncStore((state) => state.isLoadingData);
    
    const [show, setShow] = useState(false);

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
            className="fixed top-0 left-0 right-0 z-9999 h-[3px] bg-slate-100/10 overflow-hidden pointer-events-none"
        >
            <div
                className="h-full bg-blue-500 animate-pulse"
                style={{ width: '100%' }}
            />
        </div>
    );
}
