"use client";

import React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { FirplakLogo } from "./FirplakLogo";
import { SyncStatus } from "./SyncStatus";
import { supabase } from "@/lib/supabase";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
    Home,
    Briefcase,
    Building2,
    Calendar,
    FileText,
    Files,
    Settings,
    Users,
    LogOut,
    Truck,
    ChevronLeft,
    ChevronRight
} from "lucide-react";

const NAV_ITEMS = [
    { label: "Inicio", href: "/", icon: Home },
    { label: "Oportunidades", href: "/oportunidades", icon: Briefcase },
    { label: "Cuentas", href: "/cuentas", icon: Building2 },
    { label: "Contactos", href: "/contactos", icon: Users },
    { label: "Actividades", href: "/actividades", icon: Calendar },
    { label: "Pedidos", href: "/pedidos", icon: Truck },
    { label: "Archivos", href: "/archivos", icon: Files },
    { label: "Usuarios", href: "/usuarios", icon: Users, requiredRole: 'ADMIN' },
    { label: "Configuración", href: "/configuracion", icon: Settings },
];

export interface SidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

export const Sidebar = React.memo(function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { userRole } = useSyncStore();
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('[Sidebar] SignOut error:', err);
        } finally {
            localStorage.removeItem('cachedUserId');
            // Force a clean redirect
            window.location.href = '/login';
        }
    };

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col bg-white text-slate-900 h-screen border-r border-gray-200 shadow-sm transition-all duration-300 z-40 shrink-0",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <div className={cn(
                "border-b border-gray-200 flex flex-col items-center justify-center transition-all",
                isCollapsed ? "p-4" : "p-6"
            )}>
                <div className="w-full flex justify-center mb-1">
                    {isCollapsed ? (
                        <img
                            src="/Isotipo FIRPLAK CRM.svg"
                            alt="Logo"
                            className="h-10 w-auto"
                        />
                    ) : (
                        <FirplakLogo className="h-8 w-auto text-blue-600" />
                    )}
                </div>
                {!isCollapsed && (
                    <p className="text-xs text-slate-500 mt-2 font-medium text-center fade-in">Version 1.0.3</p>
                )}

                <button
                    onClick={toggleSidebar}
                    className={cn(
                        "mt-4 flex items-center justify-center p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors border border-slate-200",
                        isCollapsed ? "w-10 h-10" : "w-full gap-2"
                    )}
                    title={isCollapsed ? "Expandir" : "Colapsar"}
                >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : (
                        <>
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Colapsar</span>
                        </>
                    )}
                </button>
            </div>

            <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
                {NAV_ITEMS.filter(item => !item.requiredRole || item.requiredRole === userRole).map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (

                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                                isActive
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                                isCollapsed && "justify-center px-0 w-12 mx-auto"
                            )}
                            prefetch={false}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {!isCollapsed && <span className="whitespace-nowrap fade-in">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className={cn("border-t border-gray-200", isCollapsed ? "p-2" : "px-4")}>
                <SyncStatus isCollapsed={isCollapsed} />
            </div>

            <div className="p-4 border-t border-gray-200 flex flex-col gap-2">
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 w-full transition-colors",
                        isCollapsed && "justify-center px-0"
                    )}
                    title={isCollapsed ? "Cerrar Sesión" : undefined}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span className="whitespace-nowrap fade-in">Cerrar Sesión</span>}
                </button>

                <ConfirmationModal
                    isOpen={showLogoutConfirm}
                    onClose={() => setShowLogoutConfirm(false)}
                    onConfirm={handleLogout}
                    isLoading={isLoggingOut}
                    title="Cerrar Sesión"
                    message="¿Estás seguro de que deseas salir del sistema? No olvides sincronizar tus cambios pendientes."
                    confirmLabel="Cerrar Sesión"
                    variant="danger"
                />
            </div>
        </aside>
    );
});
