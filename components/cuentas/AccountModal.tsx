"use client";

import React, { useEffect } from "react";
import { X, Building2 } from "lucide-react";
import { AccountForm } from "./AccountForm";

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: any;
    onAccountUpdated?: () => void;
}

export function AccountModal({ isOpen, onClose, account, onAccountUpdated }: AccountModalProps) {
    // Lock scroll on background body when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen || !account) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Click outside to close (desktop overlay) */}
            <div 
                className="absolute inset-0 -z-10" 
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Container */}
            <div className="w-full h-full md:h-[90vh] md:max-w-4xl bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="sticky top-0 z-20 bg-slate-900 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-slate-800 text-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl shrink-0">
                            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-400">Detalles de Cuenta</p>
                            <h2 className="text-base sm:text-lg font-bold truncate text-white">
                                {account.nombre || "Cuenta"}
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0 ml-2"
                        title="Cerrar ventana"
                        aria-label="Cerrar ventana"
                    >
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                {/* Modal Content / Form */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50">
                    <AccountForm
                        key={account.id}
                        account={account}
                        onSuccess={() => {
                            if (onAccountUpdated) onAccountUpdated();
                            onClose();
                        }}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
