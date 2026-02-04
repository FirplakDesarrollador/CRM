"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { OfflineBanner } from "./OfflineBanner";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { useEffect, useState } from "react";
import { syncEngine } from "@/lib/sync";
import { usePathname } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { cn } from "@/components/ui/utils";
import { supabase } from "@/lib/supabase";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const setOnline = useSyncStore((state) => state.setOnline);
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    // Auth state listener - Redirect to login when signed out (critical for mobile)
    useEffect(() => {
        if (isLoginPage) return; // Don't listen on login page

        // Check initial session
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session && navigator.onLine) {
                    window.location.replace('/login');
                }
            } catch (err) {
                console.warn('[AppLayout] Session check failed (likely offline):', err);
            }
        };

        checkSession();

        // Listen for auth state changes (SIGNED_OUT, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

            if (event === 'SIGNED_OUT') {
                // Clear any cached data
                localStorage.removeItem('cachedUserId');
                sessionStorage.removeItem('crm_initialSyncDone');
                // Redirect to login
                window.location.replace('/login');
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [isLoginPage]);

    // Global monitoring of online status
    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Initial check
        setOnline(navigator.onLine);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [setOnline]);

    // Trigger sync on app initialization (pull + push)
    // PERF OPTIMIZATION: Only sync once per session to avoid repeated network calls
    useEffect(() => {
        if (!isLoginPage) {
            // Check if we already synced this session
            const hasInitialSync = sessionStorage.getItem('crm_initialSyncDone');
            if (hasInitialSync) {
                return;
            }

            syncEngine.triggerSync();
            sessionStorage.setItem('crm_initialSyncDone', 'true');
        }
    }, [isLoginPage]);

    const [isCollapsed, setIsCollapsed] = useState(false);

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <LoadingOverlay />
            {/* Sidebar (Desktop) */}
            <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative h-full overflow-hidden">
                <OfflineBanner />
                <TopBar />

                <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 scroll-smooth">
                    {children}
                </main>
            </div>

            {/* Bottom Nav (Mobile) */}
            <MobileNav />
        </div>
    );
}
