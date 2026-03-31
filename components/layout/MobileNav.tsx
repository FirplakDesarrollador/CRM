"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";
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
    Files,
    UserCircle
} from "lucide-react";

const MOBILE_NAV = [
    { label: "Inicio", href: "/", icon: Home },
    { label: "Oportunidades", href: "/oportunidades", icon: Briefcase },
    { label: "Cuentas", href: "/cuentas", icon: Building2 },
    { label: "Contactos", href: "/contactos", icon: Users },
    { label: "Actividades", href: "/actividades", icon: Calendar },
    { label: "Pedidos", href: "/pedidos", icon: Truck },
    { label: "Comisiones", href: "/comisiones", icon: DollarSign },
    { label: "Indicadores", href: "/indicadores", icon: BarChart3 },
    { label: "Archivos", href: "/archivos", icon: Files },
    { label: "Usuarios", href: "/usuarios", icon: UserCircle },
    { label: "Configuración", href: "/configuracion", icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav 
            data-testid="mobile-nav" 
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
        >
            <div className="flex items-center h-16 overflow-x-auto no-scrollbar snap-x snap-mandatory px-2">
                {MOBILE_NAV.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            data-testid={`mobile-nav-${item.href.replace('/', '') || 'home'}`}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-[72px] h-full space-y-1 transition-all snap-start",
                                isActive ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 rounded-xl transition-colors",
                                isActive && "bg-blue-50"
                            )}>
                                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-semibold transition-all",
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
}
