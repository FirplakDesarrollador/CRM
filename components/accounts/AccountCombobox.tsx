"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAccountsServer } from "@/lib/hooks/useAccountsServer";
import { resolveAccountComboboxLabel } from "@/lib/accountSearchHelpers";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

interface AccountComboboxProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    initialLabel?: string;
}

export function AccountCombobox({
    value,
    onChange,
    disabled = false,
    initialLabel
}: AccountComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const listRef = React.useRef<HTMLDivElement | null>(null);

    // Consulta directa, liviana y aislada de los filtros de /cuentas
    const {
        data: accounts,
        loading,
        hasMore,
        loadMore,
        setSearchTerm
    } = useAccountsServer({
        pageSize: 20,
        ignorePersistedFilters: true,
        lightweight: true,
    });

    const observer = React.useRef<IntersectionObserver | null>(null);
    const lastElementRef = React.useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMore();
                }
            },
            { root: listRef.current }
        );
        if (node) observer.current.observe(node);
    }, [loading, hasMore, loadMore]);

    // Debounce de búsqueda
    React.useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchTerm(search);
        }, 250);
        return () => clearTimeout(timeout);
    }, [search, setSearchTerm]);

    const [selectedAccountName, setSelectedAccountName] = React.useState<string>("");
    const [isResolvingLabel, setIsResolvingLabel] = React.useState<boolean>(false);

    // Resuelve el nombre visible del valor seleccionado sin quedar bloqueado en "Cargando..."
    React.useEffect(() => {
        const currentId = String(value || "").trim();
        if (!currentId || currentId === "undefined" || currentId === "null") {
            setSelectedAccountName("");
            setIsResolvingLabel(false);
            return;
        }

        const found = accounts.find(a => String(a.id) === currentId);
        if (found?.nombre) {
            setSelectedAccountName(found.nombre);
            setIsResolvingLabel(false);
            return;
        }
        if (initialLabel) {
            setSelectedAccountName(initialLabel);
            setIsResolvingLabel(false);
            return;
        }

        let isCancelled = false;
        setIsResolvingLabel(true);
        (async () => {
            try {
                if (typeof navigator === 'undefined' || navigator.onLine) {
                    const { data } = await supabase
                        .from('CRM_Cuentas')
                        .select('id, nombre')
                        .eq('id', currentId)
                        .maybeSingle();
                    if (!isCancelled && data?.nombre) {
                        setSelectedAccountName(data.nombre);
                    }
                }
            } catch {
                // Ignorar error de red al resolver etiqueta
            } finally {
                if (!isCancelled) {
                    setIsResolvingLabel(false);
                }
            }
        })();

        return () => { isCancelled = true; };
    }, [value, accounts, initialLabel]);

    const displayLabel = resolveAccountComboboxLabel({
        value,
        accounts,
        resolvedName: selectedAccountName,
        initialLabel,
        isResolving: isResolvingLabel,
    });

    return (
        <Popover open={open && !disabled} onOpenChange={(next) => !disabled && setOpen(next)}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-left",
                        disabled && "bg-slate-100 text-slate-500 opacity-80 cursor-not-allowed",
                        !value && "text-slate-500"
                    )}
                >
                    <span className="truncate">{displayLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[calc(100vw-2rem)] p-0 z-[80] bg-white shadow-xl border border-slate-200 rounded-xl overflow-hidden"
                align="start"
                sideOffset={4}
                collisionPadding={12}
                avoidCollisions={true}
            >
                <Command shouldFilter={false}>
                    <div className="flex items-center border-b px-3 gap-2">
                        {loading ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                        ) : (
                            <Search className="h-4 w-4 shrink-0 opacity-50" />
                        )}
                        <input
                            className="flex h-11 w-full rounded-md bg-transparent py-2.5 text-base sm:text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Buscar cuenta por nombre, NIT o tel..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                                title="Limpiar búsqueda"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <CommandList
                        ref={listRef}
                        className="max-h-[min(280px,calc(var(--radix-popover-content-available-height,280px)-56px))] overflow-y-auto overflow-x-hidden overscroll-contain p-1"
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        <CommandEmpty>
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    <span>Buscando cuentas...</span>
                                </div>
                            ) : (
                                "No se encontraron cuentas."
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {accounts.map((acc, index) => {
                                const isLast = index === accounts.length - 1;
                                return (
                                    <CommandItem
                                        key={acc.id}
                                        value={acc.id}
                                        onSelect={() => {
                                            setSelectedAccountName(acc.nombre);
                                            onChange(acc.id);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer py-2.5 sm:py-2"
                                    >
                                        <div
                                            ref={isLast ? lastElementRef : null}
                                            className="flex items-center w-full"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4 shrink-0",
                                                    value === acc.id ? "opacity-100 text-blue-600" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="truncate font-medium">{acc.nombre}</span>
                                                {(acc.nit_base || acc.ciudad) && (
                                                    <span className="text-[11px] text-slate-500 truncate">
                                                        {[acc.nit_base ? `NIT: ${acc.nit_base}` : null, acc.ciudad].filter(Boolean).join(" · ")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                            {loading && accounts.length > 0 && (
                                <div className="flex items-center justify-center gap-2 p-3 text-xs text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    <span>Buscando...</span>
                                </div>
                            )}
                            {!loading && hasMore && accounts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => loadMore()}
                                    className="w-full py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                    Cargar más cuentas
                                </button>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
