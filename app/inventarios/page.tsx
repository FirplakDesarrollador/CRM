"use client";

import { ShieldAlert, Warehouse } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { InventoryManager } from "@/components/inventory/InventoryManager";

export default function InventoryPage() {
    const { role, isLoading } = useCurrentUser();
    if (isLoading) return <div className="p-8 text-slate-500">Cargando permisos...</div>;
    if (role !== "ADMIN") return <div className="p-8 max-w-xl mx-auto"><div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center"><ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" /><h1 className="font-bold text-amber-950 text-xl">Acceso restringido</h1><p className="text-amber-800 text-sm mt-2">Inventarios esta disponible exclusivamente para administradores.</p></div></div>;

    return <div className="p-6 max-w-[1700px] mx-auto space-y-6"><header className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-indigo-100 text-indigo-700"><Warehouse className="w-7 h-7" /></div><div><h1 className="text-3xl font-bold text-slate-900">Inventarios</h1><p className="text-slate-500">Entradas, salidas, reservas y disponibilidad calculada.</p></div></header><InventoryManager /></div>;
}

