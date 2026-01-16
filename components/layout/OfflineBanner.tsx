"use client";

import { useSyncStore } from "@/lib/stores/useSyncStore";
import { cn } from "@/components/ui/utils";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
    const isOnline = useSyncStore((state) => state.isOnline);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || isOnline) return null; // Wait for client mount

    return (
        <div className="bg-orange-500 text-white text-xs font-medium py-1 px-4 text-center flex items-center justify-center gap-2 shadow-sm animate-in slide-in-from-top-2">
            <WifiOff className="w-3 h-3" />
            <span>Estás trabajando en modo offline. Los cambios se guardarán localmente.</span>
        </div>
    );
}
