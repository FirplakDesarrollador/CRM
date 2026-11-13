"use client";

import { ChevronLeft, MoreHorizontal, FileText, CheckCircle2, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface HeaderAction {
    label: string;
    icon?: any;
    onClick: () => void;
    variant?: 'default' | 'danger';
}

interface DetailHeaderProps {
    title: string;
    subtitle: string;
    status: string;
    backHref?: string;
    onBack?: () => void;
    actions?: HeaderAction[];
    /** Si se pasa, el título se puede editar en línea (lápiz junto al nombre). */
    onTitleSave?: (newTitle: string) => Promise<void>;
    titleEditLabel?: string;
}

export function DetailHeader({ title, subtitle, status, backHref, onBack, actions, onTitleSave, titleEditLabel = "Editar nombre" }: DetailHeaderProps) {
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [draftTitle, setDraftTitle] = useState(title);
    const [isSavingTitle, setIsSavingTitle] = useState(false);
    const [titleError, setTitleError] = useState<string | null>(null);

    const startTitleEdit = () => {
        setDraftTitle(title);
        setTitleError(null);
        setIsEditingTitle(true);
    };

    const cancelTitleEdit = () => {
        setIsEditingTitle(false);
        setTitleError(null);
    };

    const saveTitle = async () => {
        if (!onTitleSave) return;
        const trimmed = draftTitle.replace(/\s+/g, ' ').trim();
        if (!trimmed) {
            setTitleError("El nombre no puede quedar vacío");
            return;
        }
        if (trimmed === title) {
            setIsEditingTitle(false);
            return;
        }
        setIsSavingTitle(true);
        try {
            await onTitleSave(trimmed);
            setIsEditingTitle(false);
            setTitleError(null);
        } catch (error) {
            setTitleError(error instanceof Error ? error.message : "No se pudo guardar el nombre");
        } finally {
            setIsSavingTitle(false);
        }
    };
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <button 
                            onClick={() => {
                                if (onBack) onBack();
                                else if (backHref) router.push(backHref);
                            }}
                            className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors shrink-0"
                            aria-label="Volver"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                            {isEditingTitle ? (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            autoFocus
                                            value={draftTitle}
                                            maxLength={250}
                                            onChange={(e) => setDraftTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); void saveTitle(); }
                                                if (e.key === 'Escape') { e.preventDefault(); cancelTitleEdit(); }
                                            }}
                                            aria-label={titleEditLabel}
                                            data-testid="detail-title-input"
                                            className="min-w-0 flex-1 text-base sm:text-xl font-bold text-slate-900 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void saveTitle()}
                                            disabled={isSavingTitle}
                                            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
                                            aria-label="Guardar nombre"
                                            data-testid="detail-title-save"
                                        >
                                            {isSavingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelTitleEdit}
                                            disabled={isSavingTitle}
                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
                                            aria-label="Cancelar edición"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {titleError && <span className="text-xs text-red-600 font-medium">{titleError}</span>}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate" title={title}>{title}</h1>
                                    {onTitleSave && (
                                        <button
                                            type="button"
                                            onClick={startTitleEdit}
                                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                                            aria-label={titleEditLabel}
                                            title={titleEditLabel}
                                            data-testid="detail-title-edit"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center text-xs sm:text-sm text-slate-500 gap-1.5 sm:gap-2 truncate">
                                <span className="truncate">{subtitle}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0" />
                                <span className={cn(
                                    "font-medium px-2 py-0.5 rounded-full text-[10px] sm:text-xs shrink-0",
                                    status === 'Ganada' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                )}>
                                    {status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative" ref={menuRef}>
                        {actions && actions.length > 0 && (
                            <>
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                                >
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>

                                {showMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 shadow-lg rounded-lg py-1 z-50 animate-in fade-in zoom-in-95">
                                        {actions.map((action, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    action.onClick();
                                                    setShowMenu(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50",
                                                    action.variant === 'danger' ? "text-red-600 hover:bg-red-50" : "text-slate-700"
                                                )}
                                            >
                                                {action.icon && <action.icon className="w-4 h-4" />}
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
