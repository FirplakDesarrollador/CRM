"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Building, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useOnClickOutside } from "@/lib/hooks/useOnClickOutside";
import { useAccountsServer } from "@/lib/hooks/useAccountsServer";
import { db } from "@/lib/db";

interface AccountSelectorProps {
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
    initialAccountName?: string | null;
}

export function AccountSelector({ 
    value, 
    onChange, 
    placeholder = "Seleccionar cuenta...", 
    className,
    initialAccountName
}: AccountSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const [currentAccountName, setCurrentAccountName] = useState(initialAccountName || "");

    // Use server search logic (works local too)
    const { 
        data: accounts, 
        loading, 
        setSearchTerm: setServerSearchTerm 
    } = useAccountsServer({ pageSize: 50 }); // Load top 50 matches

    // @ts-ignore
    useOnClickOutside(containerRef, () => setIsOpen(false));

    // Handle debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setServerSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, setServerSearchTerm]);

    // Robust name resolution: initial, selected, or fallback from DB
    useEffect(() => {
        const resolve = async () => {
            // Priority 1: initialAccountName if provided and no name set
            if (initialAccountName && !currentAccountName) {
                setCurrentAccountName(initialAccountName);
                return;
            }

            // Priority 2: Value changes but we need the name
            if (value) {
                // Try current results
                const found = accounts.find(a => a.id === value);
                if (found) {
                    setCurrentAccountName(found.nombre);
                    return;
                }
                
                // Final fallback: fetch from local Dexie
                const acc = await db.accounts.get(value);
                if (acc) {
                    setCurrentAccountName(acc.nombre);
                }
            } else {
                setCurrentAccountName("");
            }
        };
        resolve();
    }, [value, initialAccountName, accounts]);

    // Ensure current selection is in the options list even if not in search results
    const options = useMemo(() => {
        const list = [...accounts];
        if (value && !list.find(a => a.id === value) && currentAccountName) {
            // Add current selection at the top if missing from search results
            list.unshift({ id: value, nombre: currentAccountName } as any);
        }
        return list;
    }, [accounts, value, currentAccountName]);

    return (
        <div className="relative w-full" ref={containerRef as any}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white transition-all text-base outline-none group",
                    className
                )}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <Building className={cn("w-5 h-5 shrink-0", value ? "text-slate-700" : "text-slate-400")} />
                    <span className={cn("truncate font-bold", value ? "text-slate-800" : "text-slate-400")}>
                        {currentAccountName || placeholder}
                    </span>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-all", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                            <input
                                autoFocus
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-base font-bold text-slate-700 focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] transition-all outline-none"
                                placeholder="Buscar por nombre o NIT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {loading && (
                                <Loader2 className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 animate-spin" />
                            )}
                        </div>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {options.length === 0 && !loading ? (
                            <div className="py-12 text-center text-slate-400">
                                <Building size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="font-bold">No se encontraron cuentas</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {options.map((acc) => (
                                    <button
                                        key={acc.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(acc.id);
                                            setCurrentAccountName(acc.nombre);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between p-4 text-left rounded-2xl transition-all group",
                                            value === acc.id
                                                ? "bg-[#254153] text-white"
                                                : "hover:bg-slate-50 text-slate-700"
                                        )}
                                    >
                                        <div className="flex flex-col min-w-0 pr-4">
                                            <span className="font-black text-base truncate">{acc.nombre}</span>
                                            {acc.nit && (
                                                <span className={cn(
                                                    "text-[10px] uppercase font-black tracking-widest",
                                                    value === acc.id ? "text-slate-300" : "text-slate-400"
                                                )}>
                                                    NIT: {acc.nit}
                                                </span>
                                            )}
                                        </div>
                                        {value === acc.id && <Check className="w-5 h-5 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
