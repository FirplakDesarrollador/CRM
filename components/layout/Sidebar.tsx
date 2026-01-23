"use client";

import React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { FirplakLogo, FirplakIsotipo } from "./FirplakLogo";
import { SyncStatus } from "./SyncStatus";
import { supabase } from "@/lib/supabase";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
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
    ChevronRight,
    UserCircle,
} from "lucide-react";

const NAV_ITEMS = [
    { label: "Inicio", href: "/", icon: Home },
    { label: "Oportunidades", href: "/oportunidades", icon: Briefcase },
    { label: "Cuentas", href: "/cuentas", icon: Building2 },
    { label: "Contactos", href: "/contactos", icon: Users },
    { label: "Actividades", href: "/actividades", icon: Calendar },
    { label: "Pedidos", href: "/pedidos", icon: Truck },
    { label: "Archivos", href: "/archivos", icon: Files },
    { label: "Usuarios", href: "/usuarios", icon: UserCircle, requiredRole: 'ADMIN' },
    { label: "Configuración", href: "/configuracion", icon: Settings },
];

// Admin-only navigation items
const ADMIN_NAV_ITEMS = [];

export interface SidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

export const Sidebar = React.memo(function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { userRole, setUserRole } = useSyncStore();
    const { user, role, isLoading } = useCurrentUser();
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);

    // Sync DB Role to UI Store
    React.useEffect(() => {
        if (!isLoading && role) {
            if (role === 'ADMIN') setUserRole('ADMIN');
            else if (role === 'COORDINADOR') setUserRole('COORDINATOR');
            else setUserRole('SALES');
        }
    }, [role, isLoading, setUserRole]);

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
                "hidden md:flex flex-col bg-linear-to-b from-white to-slate-50/50 text-slate-900 h-screen border-r border-slate-200/60 shadow-lg transition-all duration-300 z-40 shrink-0 group",
                isCollapsed ? "w-20" : "w-72"
            )}
        >
            {/* Header Section */}
            <div className={cn(
                "border-b border-slate-200/60 bg-white flex flex-col items-center justify-center transition-all relative",
                isCollapsed ? "p-4" : "p-6"
            )}>
                {/* Logo */}
                <div className="w-full flex justify-center mb-2">
                    {isCollapsed ? (
                        <div className="w-12 h-12 bg-linear-to-br from-[#254153] to-[#1a2f3d] rounded-2xl flex items-center justify-center shadow-lg transition-all p-2.5 text-white">
                            <FirplakIsotipo className="w-full h-full" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-2 h-12">
                            <FirplakLogo className="h-full w-auto text-[#254153]" />
                        </div>
                    )}
                </div>

                {!isCollapsed && (
                    <div className="w-full mt-3 pt-3 border-t border-slate-200/60">
                        <p className="text-xs text-slate-400 text-center font-semibold uppercase tracking-wider">
                            Versión 1.0.4
                        </p>
                    </div>
                )}

                {/* Collapse/Expand Button - Subtle Design */}
                <button
                    onClick={toggleSidebar}
                    className={cn(
                        "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-slate-200 text-slate-400 hover:border-[#254153] hover:text-[#254153] hover:bg-slate-50 transition-all shadow-md flex items-center justify-center"
                    )}
                    title={isCollapsed ? "Expandir" : "Colapsar"}
                >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
                {NAV_ITEMS.filter(item => {
                    // STRICT: Users module is ADMIN only
                    // This overrides any allowlist configuration
                    if (item.href === '/usuarios' && userRole !== 'ADMIN') return false;

                    // Admins see everything by default
                    if (userRole === 'ADMIN') return true;

                    // Dynamic Config: If defined, strictly follow the allowed list
                    // This allows granting "Admin-only" modules to other roles if strictly configured
                    if (user?.allowed_modules && user.allowed_modules.length > 0) {
                        return user.allowed_modules.includes(item.href);
                    }

                    // Fallback to Role Default limits
                    if (item.requiredRole && item.requiredRole !== userRole) return false;

                    return true;
                }).map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold group/item relative",
                                isActive
                                    ? "bg-linear-to-r from-[#254153] to-[#1a2f3d] text-white shadow-lg shadow-[#254153]/20"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-[#254153]",
                                isCollapsed && "justify-center px-0 w-14 mx-auto"
                            )}
                            prefetch={false}
                        >
                            <item.icon className={cn(
                                "w-5 h-5 shrink-0 transition-transform",
                                !isActive && "group-hover/item:scale-110"
                            )} />
                            {!isCollapsed && (
                                <span className="whitespace-nowrap">{item.label}</span>
                            )}
                            {isActive && !isCollapsed && (
                                <div className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full"></div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Sync Status Section */}
            <div className={cn(
                "border-t border-slate-200/60 bg-white/50",
                isCollapsed ? "p-2" : "px-4 py-3"
            )}>
                <SyncStatus isCollapsed={isCollapsed} />
            </div>

            {/* Logout Section */}
            <div className="p-4 border-t border-slate-200/60 bg-white">
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 w-full transition-all rounded-xl group/logout",
                        isCollapsed && "justify-center px-0 w-14 mx-auto"
                    )}
                    title={isCollapsed ? "Cerrar Sesión" : undefined}
                >
                    <LogOut className={cn(
                        "w-5 h-5 shrink-0 transition-transform",
                        "group-hover/logout:scale-110"
                    )} />
                    {!isCollapsed && <span className="whitespace-nowrap">Cerrar Sesión</span>}
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
