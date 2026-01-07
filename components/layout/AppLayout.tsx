"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { OfflineBanner } from "./OfflineBanner";
import { useSyncStore } from "@/lib/store/sync";
import { useEffect } from "react";
import { syncEngine } from "@/lib/sync";
import { usePathname } from "next/navigation";

export function AppLayout({ children }: { children: React.ReactNode }) {
    const setOnline = useSyncStore((state) => state.setOnline);
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

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

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar (Desktop) */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:ml-64 relative h-full overflow-hidden">
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
