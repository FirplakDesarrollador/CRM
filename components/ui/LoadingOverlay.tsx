"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";

/**
 * PERF FIX: Replaced full-screen backdrop-blur overlay with a thin top progress bar.
 * The original used backdrop-blur-md + fixed inset-0 which forced the GPU
 * to blur the entire viewport (~50-100ms per frame) on every navigation.
 *
 * Now only shows for isProcessing (sync operations).
 * Navigation feedback is handled by app/loading.tsx (Suspense boundary).
 */
export function LoadingOverlay() {
    const isProcessing = useSyncStore((state) => state.isProcessing);

    if (!isProcessing) return null;

    return (
        <div data-testid="loading-overlay" className="fixed top-0 left-0 right-0 z-9999 h-1 bg-slate-100 overflow-hidden">
            <div
                className="h-full bg-linear-to-r from-blue-600 to-[#254153] animate-[loading_1.2s_ease-in-out_infinite]"
                style={{ width: '40%' }}
            />
            <style jsx>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                }
            `}</style>
        </div>
    );
}
