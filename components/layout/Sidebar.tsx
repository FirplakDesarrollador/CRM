"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { SyncStatus } from "./SyncStatus";
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
        <aside className="hidden md:flex flex-col w-64 bg-white text-slate-900 h-screen fixed left-0 top-0 border-r border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
                <h1 className="text-xl font-bold text-blue-600">
                    CRM FIRPLAK
                </h1>
                <p className="text-xs text-slate-500 mt-1">Version 1.0.0</p>
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
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-4 border-t border-gray-200">
                <SyncStatus />
            </div>

            <div className="p-4 border-t border-gray-200">
                <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 w-full transition-colors">
                    <LogOut className="w-5 h-5" />
                    Cerrar Sesión
                </button>
            </div>
        </aside>
    );
}
