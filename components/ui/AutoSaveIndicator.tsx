import React from "react";
import { Cloud, Loader2, AlertCircle, Check } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface AutoSaveIndicatorProps {
    status: "saved" | "saving" | "error";
    className?: string;
    errorMessage?: string | null;
}

export function AutoSaveIndicator({ status, className, errorMessage }: AutoSaveIndicatorProps) {
    return (
        <div
            title={status === "error" && errorMessage ? errorMessage : undefined}
            className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-300 select-none cursor-default",
                status === "saved" && "bg-slate-50 border-slate-200 text-slate-500",
                status === "saving" && "bg-blue-50 border-blue-200 text-blue-600 animate-pulse",
                status === "error" && "bg-red-50 border-red-200 text-red-600",
                className
            )}
        >
            {status === "saved" && (
                <>
                    <Cloud className="w-3.5 h-3.5 text-slate-400" />
                    <span className="flex items-center gap-0.5">
                        Guardado <Check className="w-3 h-3 text-slate-400" />
                    </span>
                </>
            )}
            {status === "saving" && (
                <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Guardando...</span>
                </>
            )}
            {status === "error" && (
                <>
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="max-w-[220px] truncate" title={errorMessage || "Error al guardar"}>
                        {errorMessage || "Error al guardar"}
                    </span>
                </>
            )}
        </div>
    );
}

export default AutoSaveIndicator;
