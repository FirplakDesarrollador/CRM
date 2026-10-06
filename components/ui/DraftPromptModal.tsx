"use client";

import React, { useEffect } from "react";
import { History, User, ShoppingBag, Clock, ArrowRight, PlusCircle, Loader2 } from "lucide-react";

interface DraftPromptModalProps {
    isOpen: boolean;
    onContinue: () => void;
    onDiscard: () => void;
    draftInfo?: {
        updatedAt?: string;
        clientName?: string;
        itemsCount?: number;
        totalAmount?: number;
    } | null;
    isDiscarding?: boolean;
}

export function DraftPromptModal({
    isOpen,
    onContinue,
    onDiscard,
    draftInfo,
    isDiscarding = false,
}: DraftPromptModalProps) {
    // Escape key handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isDiscarding) {
                onContinue();
            }
        };
        if (isOpen) window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onContinue, isDiscarding]);

    if (!isOpen) return null;

    const formattedDate = draftInfo?.updatedAt ? (() => {
        try {
            const d = new Date(draftInfo.updatedAt);
            return d.toLocaleString("es-CO", {
                dateStyle: "medium",
                timeStyle: "short"
            });
        } catch {
            return null;
        }
    })() : null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                aria-hidden="true"
            />

            {/* Modal Box */}
            <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Decorative Top Accent */}
                <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />

                <div className="p-6 sm:p-7">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                        <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/80 shrink-0 shadow-sm">
                            <History className="w-6 h-6" />
                        </div>

                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                                Borrador de Registro Encontrado
                            </h3>
                            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                                Tienes un borrador sin finalizar guardado en tu cuenta. ¿Deseas continuar con el registro existente o prefieres crear uno nuevo?
                            </p>
                        </div>
                    </div>

                    {/* Resumen del Borrador */}
                    {draftInfo && (
                        <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs sm:text-sm text-slate-700">
                            <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                <User className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-slate-500 font-normal">Cliente / Cuenta:</span>
                                <span className="truncate">{draftInfo.clientName || "Sin cliente especificado"}</span>
                            </div>

                            {typeof draftInfo.itemsCount === "number" && draftInfo.itemsCount > 0 && (
                                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                    <ShoppingBag className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-slate-500 font-normal">Productos:</span>
                                    <span>{draftInfo.itemsCount} artículo(s) agregado(s)</span>
                                </div>
                            )}

                            {formattedDate && (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span>Último guardado:</span>
                                    <span>{formattedDate}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botones de Acción */}
                    <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3 justify-end items-stretch sm:items-center">
                        <button
                            type="button"
                            onClick={onDiscard}
                            disabled={isDiscarding}
                            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 hover:border-red-200 border border-transparent rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isDiscarding ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                            ) : (
                                <PlusCircle className="w-4 h-4" />
                            )}
                            <span>Crear uno nuevo</span>
                        </button>

                        <button
                            type="button"
                            onClick={onContinue}
                            disabled={isDiscarding}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                        >
                            <span>Continuar con registro existente</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
