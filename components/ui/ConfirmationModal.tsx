"use client";

import React, { useEffect } from 'react';
import { AlertCircle, HelpCircle, X } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Aceptar",
    cancelLabel = "Cancelar",
    variant = 'info',
    isLoading = false
}: ConfirmationModalProps) {
    // Close on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={isLoading ? undefined : onClose}
            />

            {/* Modal Container */}
            <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header/Banner decorative */}
                <div className={cn(
                    "h-2 w-full",
                    variant === 'danger' ? "bg-red-500" :
                        variant === 'warning' ? "bg-amber-500" : "bg-blue-500"
                )} />

                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "p-3 rounded-2xl shrink-0",
                            variant === 'danger' ? "bg-red-50 text-red-600" :
                                variant === 'warning' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                        )}>
                            {variant === 'danger' || variant === 'warning' ? (
                                <AlertCircle className="w-6 h-6" />
                            ) : (
                                <HelpCircle className="w-6 h-6" />
                            )}
                        </div>

                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                                {message}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={cn(
                                "px-6 py-2.5 text-sm font-bold text-white rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2",
                                variant === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-200" :
                                    variant === 'warning' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
                                isLoading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {isLoading && (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            <span className="relative z-10 text-white! font-bold">{confirmLabel}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
