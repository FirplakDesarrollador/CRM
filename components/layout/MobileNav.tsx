"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";
import { Home, Briefcase, Building2, Calendar, Menu } from "lucide-react";

// Mobile shows fewer items directly, others in "Menu"
const MOBILE_NAV = [
    { label: "Inicio", href: "/", icon: Home },
    { label: "Opport.", href: "/oportunidades", icon: Briefcase },
    { label: "Cuentas", href: "/cuentas", icon: Building2 },
    { label: "Agenda", href: "/actividades", icon: Calendar },
    { label: "Menú", href: "/configuracion", icon: Menu }, // Simplified for now
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                {MOBILE_NAV.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1",
                                isActive ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", isActive && "fill-current/10")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
