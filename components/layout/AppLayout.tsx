"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { OfflineBanner } from "./OfflineBanner";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { useEffect, useState, useCallback } from "react";
import { syncEngine } from "@/lib/sync";
import { usePathname } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
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

    // PERF FIX: Removed the navigation click interceptor and popstate listener.
    // They set isNavigating=true which triggered the LoadingOverlay (backdrop-blur-md)
    // on EVERY link click, adding ~50-100ms GPU cost per navigation.
    // Navigation feedback is now handled by app/loading.tsx (Suspense boundary)
    // which renders a lightweight progress bar instead.

    // Sync: initial + periodic (5 min) + visibility change (user returns to tab)
    useEffect(() => {
        if (isLoginPage) return;

        // 1. Initial sync on mount
        syncEngine.triggerSync();

        // 2. Periodic sync every 5 minutes
        const intervalId = setInterval(() => {
            if (navigator.onLine) {
                syncEngine.triggerSync();
            }
        }, 5 * 60 * 1000);

        // 3. Sync when user returns to tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                syncEngine.triggerSync();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isLoginPage]);

    const [isCollapsed, setIsCollapsed] = useState(false);

    // PERF FIX: Stable callback reference prevents Sidebar (React.memo) from re-rendering
    const toggleSidebar = useCallback(() => setIsCollapsed(prev => !prev), []);

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <LoadingOverlay />
            {/* Sidebar (Desktop) */}
            <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />

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
