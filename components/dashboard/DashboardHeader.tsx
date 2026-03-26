"use client";

import React from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { getFriendlyToday } from "@/lib/date-utils";
import { Settings2, Check, X, RotateCcw } from "lucide-react";

interface DashboardHeaderProps {
    onPersonalize?: () => void;
    isEditing?: boolean;
    onSave?: () => void;
    onCancel?: () => void;
    onReset?: () => void;
}

export const DashboardHeader = ({ onPersonalize, isEditing, onSave, onCancel, onReset }: DashboardHeaderProps) => {
    const { user, isLoading } = useCurrentUser();
    const formattedDate = getFriendlyToday();

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    Hola, {isLoading ? "..." : (user?.full_name || user?.email?.split("@")[0] || "Usuario")} 👋
                </h1>
                <p className="text-slate-500 mt-1 capitalize">{formattedDate}</p>
            </div>

            {isEditing ? (
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#254153] bg-blue-50 px-3 py-1.5 rounded-lg mr-1">
                        Arrastra los tiles para reordenar
                    </span>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
                        title="Restaurar orden por defecto"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restablecer
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <X className="w-4 h-4" />
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#254153] rounded-xl text-sm font-semibold text-white hover:bg-[#1a2f3d] transition-all shadow-sm"
                    >
                        <Check className="w-4 h-4" />
                        Guardar
                    </button>
                </div>
            ) : (
                <button
                    onClick={onPersonalize}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <Settings2 className="w-4 h-4 text-[#254153]" />
                    Personalizar
                </button>
            )}
        </div>
    );
};
