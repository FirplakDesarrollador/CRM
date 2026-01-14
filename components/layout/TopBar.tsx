import { useSyncStore } from "@/lib/stores/useSyncStore";
import { cn } from "@/components/ui/utils";
import { Bell, Search, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
// Re-export NotificationList to ensure HMR picks it up
import { Notifications } from "./Notifications";

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
            <h1 className="md:hidden text-lg font-bold text-slate-800">CRM FIRPLAK</h1>

            {/* Desktop Search (Placeholder) */}
            <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2 w-96">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                    type="text"
                    placeholder="Buscar cuentas, oportunidades..."
                    className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-700"
                />
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
