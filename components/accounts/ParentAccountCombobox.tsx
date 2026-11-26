"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { cn, accentInsensitiveCondition, getSearchTokens, matchesSearchTokens } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

export interface ParentAccountOption {
    id: string;
    nombre: string;
    nit_base?: string | null;
    canal_id?: string | null;
}

interface ParentAccountComboboxProps {
    value?: string | null;
    onChange: (parentId: string, parent: ParentAccountOption | null) => void;
    excludeAccountId?: string;
    initialParent?: ParentAccountOption | null;
    disabled?: boolean;
    allowClear?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    triggerClassName?: string;
    dataTestId?: string;
}

const PAGE_SIZE = 30;

export function ParentAccountCombobox({
    value,
    onChange,
    excludeAccountId,
    initialParent,
    disabled = false,
    allowClear = true,
    placeholder = "Seleccione cuenta principal...",
    searchPlaceholder = "Buscar cuenta principal por nombre o NIT...",
    triggerClassName,
    dataTestId,
}: ParentAccountComboboxProps) {
    const listboxId = React.useId();
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    const [options, setOptions] = React.useState<ParentAccountOption[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const [page, setPage] = React.useState(0);
    const [resolvedParent, setResolvedParent] = React.useState<ParentAccountOption | null>(initialParent || null);
    const fetchSeqRef = React.useRef(0);

    React.useEffect(() => {
        if (initialParent && initialParent.id === value) {
            setResolvedParent(initialParent);
        }
    }, [initialParent, value]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 250);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchPage = React.useCallback(async (pageIdx: number, term: string, append: boolean) => {
        const seq = ++fetchSeqRef.current;
        setLoading(true);
        const from = pageIdx * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const fallbackOffline = async () => {
            const localAccounts = await db.accounts.toArray();
            const filtered = localAccounts
                .filter((a) => !a.is_deleted && !a.id_cuenta_principal && a.id !== excludeAccountId)
                .filter((a) => matchesSearchTokens([a.nombre, a.nit_base], term))
                .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            const slice = filtered.slice(from, to + 1).map((a) => ({
                id: a.id,
                nombre: a.nombre,
                nit_base: a.nit_base || null,
                canal_id: a.canal_id || null,
            }));
            if (seq !== fetchSeqRef.current) return;
            setOptions((prev) => (append ? [...prev, ...slice] : slice));
            setHasMore(filtered.length > to + 1);
            setPage(pageIdx);
        };

        try {
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                await fallbackOffline();
                return;
            }

            let query = supabase
                .from("CRM_Cuentas")
                .select("id, nombre, nit_base, canal_id")
                .is("id_cuenta_principal", null)
                .eq("is_deleted", false);

            if (excludeAccountId) {
                query = query.neq("id", excludeAccountId);
            }

            const tokens = getSearchTokens(term);
            for (const token of tokens) {
                const nameCond = accentInsensitiveCondition("nombre", token);
                query = query.or(`${nameCond},nit_base.ilike.%${token}%`);
            }

            const { data, error } = await query
                .order("nombre", { ascending: true })
                .range(from, to);

            if (error) {
                await fallbackOffline();
                return;
            }

            if (seq !== fetchSeqRef.current) return;
            const rows: ParentAccountOption[] = (data || []).map((row: {
                id: string;
                nombre: string | null;
                nit_base?: string | null;
                canal_id?: string | null;
            }) => ({
                id: String(row.id),
                nombre: String(row.nombre || ""),
                nit_base: row.nit_base ?? null,
                canal_id: row.canal_id ?? null,
            }));
            setOptions((prev) => {
                if (!append) return rows;
                const seen = new Set(prev.map((item) => item.id));
                return [...prev, ...rows.filter((item) => !seen.has(item.id))];
            });
            setHasMore(rows.length === PAGE_SIZE);
            setPage(pageIdx);
        } catch {
            await fallbackOffline();
        } finally {
            if (seq === fetchSeqRef.current) {
                setLoading(false);
            }
        }
    }, [excludeAccountId]);

    React.useEffect(() => {
        if (!open) return;
        fetchPage(0, debouncedSearch, false);
    }, [open, debouncedSearch, fetchPage]);

    // Resolve label for already-selected value even if not in current page
    React.useEffect(() => {
        const currentId = String(value || "").trim();
        if (!currentId) {
            setResolvedParent(null);
            return;
        }
        if (resolvedParent?.id === currentId) return;
        if (initialParent?.id === currentId) {
            setResolvedParent(initialParent);
            return;
        }
        const fromList = options.find((opt) => opt.id === currentId);
        if (fromList) {
            setResolvedParent(fromList);
            return;
        }

        let cancelled = false;
        const resolveSelected = async () => {
            try {
                const local = await db.accounts.get(currentId);
                if (!cancelled && local) {
                    setResolvedParent({
                        id: local.id,
                        nombre: local.nombre,
                        nit_base: local.nit_base || null,
                        canal_id: local.canal_id || null,
                    });
                    return;
                }
                if (typeof navigator !== "undefined" && !navigator.onLine) return;
                const { data } = await supabase
                    .from("CRM_Cuentas")
                    .select("id, nombre, nit_base, canal_id")
                    .eq("id", currentId)
                    .maybeSingle();
                if (!cancelled && data) {
                    setResolvedParent({
                        id: String(data.id),
                        nombre: String(data.nombre || ""),
                        nit_base: data.nit_base ?? null,
                        canal_id: data.canal_id ?? null,
                    });
                }
            } catch {
                // Keep graceful fallback
            }
        };
        resolveSelected();
        return () => {
            cancelled = true;
        };
    }, [value, initialParent, options, resolvedParent?.id]);

    const handleOpenChange = (next: boolean) => {
        if (disabled) return;
        setOpen(next);
        if (!next) {
            setSearch("");
        }
    };

    const selectedLabel = resolvedParent
        ? `${resolvedParent.nombre}${resolvedParent.nit_base ? ` (${resolvedParent.nit_base})` : ""}`
        : value
            ? "Cuenta principal seleccionada"
            : placeholder;

    return (
        <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open && !disabled}
                    aria-controls={listboxId}
                    data-testid={dataTestId}
                    disabled={disabled}
                    className={cn(
                        "flex min-h-[42px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 transition-colors text-left",
                        triggerClassName
                    )}
                >
                    <span className={cn("truncate flex-1 mr-2", !value && "text-slate-400 font-normal")}>
                        {selectedLabel}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                        {allowClear && !!value && !disabled && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setResolvedParent(null);
                                    onChange("", null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setResolvedParent(null);
                                        onChange("", null);
                                    }
                                }}
                                className="p-0.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer text-xs font-bold leading-none"
                                title="Limpiar selección"
                            >
                                ✕
                            </span>
                        )}
                        <ChevronsUpDown className="h-4 w-4 opacity-50 text-slate-500" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-2rem)] p-0 z-[110] shadow-xl border border-slate-200 rounded-xl overflow-hidden bg-white"
                align="start"
                sideOffset={4}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                }}
            >
                <Command shouldFilter={false} className="w-full">
                    <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                        <input
                            autoFocus
                            className="flex h-10 w-full rounded-md bg-transparent py-2 text-base sm:text-sm outline-none placeholder:text-slate-400"
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <CommandList
                        id={listboxId}
                        className="max-h-64 overflow-y-auto overscroll-contain p-1"
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        {loading && options.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 py-5 text-xs text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                <span>Buscando cuentas principales...</span>
                            </div>
                        ) : options.length === 0 ? (
                            <div className="py-5 px-3 text-center text-xs text-slate-500">
                                No se encontraron cuentas principales.
                            </div>
                        ) : (
                            <CommandGroup>
                                {options.map((acc) => {
                                    const isSelected = value === acc.id;
                                    return (
                                        <CommandItem
                                            key={acc.id}
                                            value={acc.id}
                                            onSelect={() => {
                                                if (allowClear && isSelected) {
                                                    setResolvedParent(null);
                                                    onChange("", null);
                                                } else {
                                                    setResolvedParent(acc);
                                                    onChange(acc.id, acc);
                                                }
                                                setOpen(false);
                                                setSearch("");
                                            }}
                                            className="flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-slate-100/80 transition-colors"
                                        >
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className={cn("truncate", isSelected ? "font-semibold text-blue-900" : "text-slate-800")}>
                                                    {acc.nombre}
                                                </span>
                                                {acc.nit_base && (
                                                    <span className="text-[11px] text-slate-500 truncate">
                                                        NIT: {acc.nit_base}
                                                    </span>
                                                )}
                                            </div>
                                            <Check
                                                className={cn(
                                                    "h-4 w-4 text-blue-600 shrink-0",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                        </CommandItem>
                                    );
                                })}
                                {hasMore && (
                                    <div className="p-1.5 text-center border-t border-slate-100 mt-1">
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => fetchPage(page + 1, debouncedSearch, true)}
                                            className="w-full py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {loading ? "Cargando..." : "Cargar más cuentas"}
                                        </button>
                                    </div>
                                )}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
