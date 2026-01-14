"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { FirplakLogo } from "./FirplakLogo";
import { SyncStatus } from "./SyncStatus";
import { supabase } from "@/lib/supabase";
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
    Truck
} from "lucide-react";

const NAV_ITEMS = [
    { label: "Inicio", href: "/", icon: Home },
    { label: "Oportunidades", href: "/oportunidades", icon: Briefcase },
    { label: "Cuentas", href: "/cuentas", icon: Building2 },
    { label: "Contactos", href: "/contactos", icon: Users },
    { label: "Actividades", href: "/actividades", icon: Calendar },
    { label: "Pedidos", href: "/pedidos", icon: Truck },
    { label: "Archivos", href: "/archivos", icon: Files },
    { label: "Configuración", href: "/configuracion", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 border-r border-slate-800">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    CRM FIRPLAK
                </h1>
                <p className="text-xs text-slate-400 mt-1">Version 1.0.0</p>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                                isActive
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-4 border-t border-slate-800">
                <SyncStatus />
            </div>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-red-400 w-full transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}
