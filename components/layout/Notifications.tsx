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

export function Notifications() {
    const { notifications, count } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getIcon = (type: NotificationItem['type']) => {
        switch (type) {
            case 'ACTIVITY_OVERDUE':
            case 'OPPORTUNITY_EXPIRED':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'ACTIVITY_TODAY':
            case 'OPPORTUNITY_EXPIRING':
                return <Calendar className="w-4 h-4 text-blue-500" />;
            case 'CLIENT_INACTIVE':
                return <UserX className="w-4 h-4 text-amber-500" />;
            default:
                return <Bell className="w-4 h-4 text-slate-500" />;
        }
    };

    const getBgColor = (type: NotificationItem['type']) => {
        switch (type) {
            case 'ACTIVITY_OVERDUE':
            case 'OPPORTUNITY_EXPIRED':
                return "bg-red-50 hover:bg-red-100";
            case 'ACTIVITY_TODAY':
            case 'OPPORTUNITY_EXPIRING':
                return "bg-blue-50 hover:bg-blue-100";
            case 'CLIENT_INACTIVE':
                return "bg-amber-50 hover:bg-amber-100";
            default:
                return "bg-slate-50 hover:bg-slate-100";
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                title="Notificaciones"
            >
                <Bell className="w-5 h-5" />
                {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden transform origin-top-right transition-all">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">Notificaciones</h3>
                        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200">
                            {count} Pendientes
                        </span>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                <CheckCircle2 className="w-12 h-12 mb-2 text-slate-200" />
                                <p className="text-sm font-medium">Estás al día</p>
                                <p className="text-xs">No hay nuevas alertas</p>
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <NextLink
                                    key={item.id}
                                    href={item.link || '#'}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-xl transition-all group",
                                        getBgColor(item.type)
                                    )}
                                >
                                    <div className="mt-0.5 shrink-0 bg-white p-1.5 rounded-lg shadow-sm">
                                        {getIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="text-xs font-bold text-slate-700">{item.title}</p>
                                            {item.date && (
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(item.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 font-medium truncate group-hover:text-slate-900 transition-colors">
                                            {item.subtitle}
                                        </p>
                                    </div>
                                </NextLink>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
