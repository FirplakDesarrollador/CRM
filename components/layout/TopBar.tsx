import { useSyncStore } from "@/lib/stores/useSyncStore";
import { cn } from "@/components/ui/utils";
import { Bell, Search, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
// Re-export NotificationList to ensure HMR picks it up
import { Notifications } from "./Notifications";
import { GlobalSearch } from "./GlobalSearch";

export function TopBar() {
    const { isSyncing, pendingCount, error: syncError } = useSyncStore();
    const [initials, setInitials] = useState("...");

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const name = user.user_metadata?.full_name || user.email || "";
                    const parts = name.split(/[.\s@]/).filter(Boolean);
                    let userInitials = "";
                    if (parts.length >= 2) {
                        userInitials = (parts[0][0] + parts[1][0]).toUpperCase();
                    } else if (parts.length === 1) {
                        userInitials = parts[0].substring(0, 2).toUpperCase();
                    }
                    setInitials(userInitials || "??");
                }
            } catch (err: any) {
                // Silently ignore network errors (offline mode)
                if (!err.message?.includes('Failed to fetch')) {
                    console.error('TopBar: Error getting user:', err);
                }
            }
        };
        fetchUser();
    }, []);

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30">
            {/* Mobile Title (Sidebar hidden) */}
            <div className="md:hidden flex items-center gap-2.5">
                <div className="w-9 h-9 bg-linear-to-br from-[#254153] to-[#1a2f3d] rounded-lg flex items-center justify-center shadow-md">
                    <img
                        src="/Isotipo FIRPLAK CRM.svg"
                        alt="Logo"
                        className="h-5 w-auto"
                    />
                </div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">CRM FIRPLAK</h1>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8">
                <GlobalSearch />
            </div>

            <div className="flex items-center gap-4">
                {/* Sync Status Badge */}
                <div className="flex items-center gap-2 text-xs font-medium">
                    {isSyncing ? (
                        <span className="flex items-center text-blue-600 gap-1 bg-blue-50 px-2 py-1 rounded-full">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Sincronizando...
                        </span>
                    ) : syncError ? (
                        <span className="flex items-center text-red-600 gap-1 bg-red-50 px-2 py-1 rounded-full cursor-pointer" title={syncError}>
                            <AlertCircle className="w-3 h-3" />
                            Error
                        </span>
                    ) : pendingCount > 0 ? (
                        <span className="flex items-center text-orange-600 gap-1 bg-orange-50 px-2 py-1 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            {pendingCount} Pendientes
                        </span>
                    ) : (
                        <span className="hidden md:flex items-center text-green-600 gap-1 bg-green-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Al día
                        </span>
                    )}
                </div>

                <Notifications />

                <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {initials}
                </div>
            </div>
        </header>
    );
}
