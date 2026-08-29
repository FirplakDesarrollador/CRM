import { useSyncStore } from "@/lib/stores/useSyncStore";
import { cn } from "@/components/ui/utils";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
// Re-export NotificationList to ensure HMR picks it up
import { Notifications } from "./Notifications";
import { GlobalSearch } from "./GlobalSearch";
import { FirplakIsotipo } from "./FirplakLogo";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { resolveSaveStatus } from "@/lib/sync-runtime";

export function TopBar() {
    const pendingCount = useSyncStore((state) => state.pendingCount);
    const attentionCount = useSyncStore((state) => state.attentionCount);
    const syncError = useSyncStore((state) => state.error);
    const { user } = useCurrentUser();

    // Derive initials from Zustand store (no network call needed)
    const initials = useMemo(() => {
        if (!user) return "...";
        const name = user.full_name || user.email || "";
        const parts = name.split(/[.\s@]/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return "??";
    }, [user]);
    const saveStatus = resolveSaveStatus({ pendingCount, attentionCount, error: syncError });

    return (
        <header data-testid="topbar" className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30">
            {/* Mobile Title (Sidebar hidden) */}
            <div className="md:hidden flex items-center gap-2.5">
                <div className="w-9 h-9 bg-linear-to-br from-[#254153] to-[#1a2f3d] rounded-lg flex items-center justify-center shadow-md p-1.5 text-white">
                    <FirplakIsotipo className="w-full h-full" />
                </div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">CRM FIRPLAK</h1>
            </div>

            {/* Desktop Spacer */}
            <div className="hidden md:flex flex-1" />

            <div className="flex items-center gap-4">
                {/* Sync Status Badge */}
                <div data-testid="topbar-sync-status" className="flex items-center gap-2 text-xs font-medium">
                    {saveStatus.kind === 'attention' ? (
                        <span className="flex items-center text-red-600 gap-1 bg-red-50 px-2 py-1 rounded-full cursor-pointer" title={syncError || `${attentionCount} cambios requieren atención`}>
                            <AlertCircle className="w-3 h-3" />
                            Requiere atención
                        </span>
                    ) : saveStatus.kind === 'pending' ? (
                        <span className="flex items-center text-amber-700 gap-1 bg-amber-50 px-2 py-1 rounded-full" title={`${pendingCount} cambios pendientes de sincronización`}>
                            <RefreshCw className="w-3 h-3" />
                            Pendiente
                        </span>
                    ) : (
                        <span className="flex items-center text-green-600 gap-1 bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Guardado
                        </span>
                    )}
                </div>

                <Notifications />

                <div data-testid="topbar-user-avatar" className="w-8 h-8 bg-linear-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {initials}
                </div>
            </div>
        </header>
    );
}
