"use client";

import { useNotifications, NotificationItem } from "@/lib/hooks/useNotifications";
import { cn } from "@/components/ui/utils";
import NextLink from "next/link";
import {
    AlertCircle,
    Calendar,
    UserX,
    CheckCircle2,
    Bell
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

/**
 * PERF FIX: Extracted into a separate component so that useNotifications()
 * (which triggers useLiveQuery on activities, opportunities, and accounts)
 * is ONLY mounted when the dropdown is open. Previously, all 3 IndexedDB
 * queries ran on every page navigation just to show the badge dot.
 */
function NotificationContent({ onClose }: { onClose: () => void }) {
    const { notifications, count, markAsRead } = useNotifications();

    const getIcon = (type: NotificationItem['type']) => {
        switch (type) {
            case 'ACTIVITY_OVERDUE':
            case 'BUDGET_MISS':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'NEW_ACCOUNT':
            case 'NEW_OPPORTUNITY':
                return <Calendar className="w-5 h-5 text-blue-500" />;
            case 'INACTIVE_CLIENT':
                return <UserX className="w-5 h-5 text-amber-500" />;
            default:
                return <Bell className="w-5 h-5 text-slate-500" />;
        }
    };

    const getBgColor = (type: NotificationItem['type']) => {
        switch (type) {
            case 'ACTIVITY_OVERDUE':
            case 'BUDGET_MISS':
                return "bg-red-50 hover:bg-red-100/80 border-red-100";
            case 'NEW_ACCOUNT':
            case 'NEW_OPPORTUNITY':
                return "bg-blue-50 hover:bg-blue-100/80 border-blue-100";
            case 'INACTIVE_CLIENT':
                return "bg-amber-50 hover:bg-amber-100/80 border-amber-100";
            default:
                return "bg-slate-50 hover:bg-slate-100 border-slate-100";
        }
    };

    const handleItemClick = (item: NotificationItem) => {
        if (item.isRead === false && markAsRead) {
            markAsRead(item.id);
        }
        onClose();
    };

    return (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center backdrop-blur-sm">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    Notificaciones
                    {count > 0 && (
                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </h3>
                <span className="text-[10px] font-bold tracking-wider text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm uppercase">
                    {count} Pendientes
                </span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <div className="bg-slate-50 p-4 rounded-full mb-3">
                            <CheckCircle2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">Estás al día</p>
                        <p className="text-xs text-slate-400">No hay nuevas alertas</p>
                    </div>
                ) : (
                    notifications.map((item) => {
                        const isUnread = item.isRead === false;

                        return (
                            <div key={item.id} className="relative group">
                                <NextLink
                                    href={item.link || '#'}
                                    onClick={() => handleItemClick(item)}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-xl transition-all border",
                                        getBgColor(item.type),
                                        isUnread ? "shadow-sm ring-1 ring-blue-500/20" : "opacity-80 hover:opacity-100"
                                    )}
                                >
                                    <div className={cn(
                                        "mt-0.5 shrink-0 p-2 rounded-xl shadow-sm",
                                        isUnread ? "bg-white" : "bg-white/50"
                                    )}>
                                        {getIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <p className={cn(
                                                "text-sm",
                                                isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                                            )}>
                                                {item.title}
                                            </p>
                                            {isUnread && (
                                                <span className="block w-2 h-2 rounded-full bg-blue-500" />
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                            {item.subtitle}
                                        </p>
                                        {item.date && (
                                            <p className="text-[10px] text-slate-400 mt-2 font-medium">
                                                {new Date(item.date).toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </NextLink>

                                {isUnread && markAsRead && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            markAsRead(item.id);
                                        }}
                                        className="absolute right-3 bottom-3 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Marcar leída
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export function Notifications() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside - only attach listener when open
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                title="Notificaciones"
            >
                <Bell className="w-5 h-5" />
            </button>

            {/* PERF: Only mount NotificationContent when open. This defers ALL
                IndexedDB queries (activities, opportunities, accounts) until
                the user clicks the bell icon instead of running on every navigation. */}
            {isOpen && <NotificationContent onClose={() => setIsOpen(false)} />}
        </div>
    );
}
