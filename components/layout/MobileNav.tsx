"use client";

import React, { memo } from "react";
import Link from "next/link";

import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { 
    Home, 
    Briefcase, 
    Building2, 
    Calendar, 
    Settings,
    Users,
    Truck,
    DollarSign,
    BarChart3,
    FileSpreadsheet,
    UserCircle,
    Store,
    Tent,
    BookOpen,
    Warehouse
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

const MOBILE_NAV = [
    { label: "Inicio", href: "/", icon: Home },
    { label: "Oportunidades", href: "/oportunidades", icon: Briefcase },
    { label: "Cuentas", href: "/cuentas", icon: Building2 },
    { label: "Contactos", href: "/contactos", icon: Users },
    { label: "Actividades", href: "/actividades", icon: Calendar },
    { label: "Pedidos", href: "/pedidos", icon: Truck },
    { label: "Comisiones", href: "/comisiones", icon: DollarSign },
    { label: "Indicadores", href: "/indicadores", icon: BarChart3 },
    { label: "Tiendas-Ferias", href: "/tiendas", icon: Store },
    { label: "Catálogo", href: "/catalogo", icon: BookOpen },
    { label: "Inventarios", href: "/inventarios", icon: Warehouse, requiredRole: "ADMIN" },
    { label: "Informes", href: "/informes", icon: FileSpreadsheet, requiredRole: "ADMIN" },
    { label: "Usuarios", href: "/usuarios", icon: UserCircle },
    { label: "Ferias", href: "/ferias", icon: Tent, requiredRole: "ADMIN" },
    { label: "Configuración", href: "/configuracion", icon: Settings },
];

export const MobileNav = memo(function MobileNav() {
    const pathname = usePathname();
    const { role, user } = useCurrentUser();

    const visibleNav = React.useMemo(() => {
        const allowedModules = user?.allowed_modules || [];
        return MOBILE_NAV.filter(item => {
            if (item.href === '/usuarios' && role !== 'ADMIN') return false;
            if (role === 'ADMIN') return true;
            if (allowedModules.length > 0) return allowedModules.includes(item.href);
            if (item.requiredRole && item.requiredRole !== role) return false;
            return true;
        });
    }, [role, user?.allowed_modules]);

    return (
        <nav 
            data-testid="mobile-nav" 
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
        >
            <div className="flex items-center h-16 overflow-x-auto no-scrollbar snap-x snap-mandatory px-2">
                {visibleNav.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            data-testid={`mobile-nav-${item.href.replace('/', '') || 'home'}`}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-[72px] h-full space-y-1 transition-[color,transform] duration-200 snap-start",
                                isActive ? "text-blue-600" : "text-slate-500 active:text-slate-900"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 rounded-xl transition-colors duration-200 pointer-events-none",
                                isActive && "bg-blue-50"
                            )}>
                                <item.icon className="w-5 h-5" />
                            </div>
                            <span className={cn(
                                "text-[10px] font-semibold transition-[opacity,transform] duration-200 pointer-events-none",
                                isActive ? "opacity-100 scale-100" : "opacity-70 scale-95"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
});
