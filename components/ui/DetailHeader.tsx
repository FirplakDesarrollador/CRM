"use client";

import { ChevronLeft, MoreHorizontal, FileText, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { useState, useRef, useEffect } from "react";

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
    backHref: string;
    actions?: HeaderAction[];
}

export function DetailHeader({ title, subtitle, status, backHref, actions }: DetailHeaderProps) {
    const [showMenu, setShowMenu] = useState(false);
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
                <div className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={backHref} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
                            <div className="flex items-center text-sm text-slate-500 gap-2">
                                <span>{subtitle}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className={cn(
                                    "font-medium px-2 py-0.5 rounded-full text-xs",
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
