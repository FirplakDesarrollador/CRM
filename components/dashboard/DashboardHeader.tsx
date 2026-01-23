"use client";

import React from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { Settings2 } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface DashboardHeaderProps {
    onPersonalize?: () => void;
}

export const DashboardHeader = ({ onPersonalize }: DashboardHeaderProps) => {
    const { user, role, isLoading } = useCurrentUser();
    const today = new Date();

    const formattedDate = today.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    Hola, {isLoading ? "..." : (user?.full_name || user?.email?.split("@")[0] || "Usuario")} 👋
                </h1>
                <p className="text-slate-500 mt-1 capitalize">{formattedDate}</p>
            </div>

            <button
                onClick={onPersonalize}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
                <Settings2 className="w-4 h-4 text-[#254153]" />
                Personalizar
            </button>
        </div>
    );
};
