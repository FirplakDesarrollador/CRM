"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccountsServer } from "@/lib/hooks/useAccountsServer";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
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

    // Default page size for infinite scroll
    const {
        data: accounts,
        loading,
        hasMore,
        loadMore,
        setSearchTerm
    } = useAccountsServer({ pageSize: 20 });

    const observer = React.useRef<IntersectionObserver | null>(null);
    const lastElementRef = React.useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore();
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore, loadMore]);

    // Handle Search with simple debounce inside effect
    React.useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchTerm(search);
        }, 300);
        return () => clearTimeout(timeout);
    }, [search, setSearchTerm]);

    const [selectedAccountName, setSelectedAccountName] = React.useState<string>("");

    // Simple effect to match the current value with the loaded accounts or the initial label
    React.useEffect(() => {
        const currentId = String(value || "");
        if (!currentId || currentId === "undefined" || currentId === "null") {
            setSelectedAccountName("");
            return;
        }

        // Try to find in current list
        const found = accounts.find(a => String(a.id) === currentId);
        if (found) {
            setSelectedAccountName(found.nombre);
        } else if (initialLabel) {
            setSelectedAccountName(initialLabel);
        } else {
            setSelectedAccountName("");
        }
    }, [value, accounts, initialLabel]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all",
                        disabled && "bg-slate-100 text-slate-500 opacity-80 cursor-not-allowed",
                        !value && "text-slate-500"
                    )}
                >
                    <span className="truncate">
                        {value ? (selectedAccountName || initialLabel || "Cargando...") : "Seleccione una cuenta..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
                side="bottom"
                sideOffset={4}
                avoidCollisions={false}
            >
                <Command shouldFilter={false}>
                    <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Buscar cuenta..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
                        <CommandEmpty>
                            {loading ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
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
                                        onSelect={(currentValue) => {
                                            onChange(currentValue);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
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
                                                <span className="truncate">{acc.nombre}</span>
                                                {acc.nit_base && (
                                                    <span className="text-[10px] text-slate-500 truncate">
                                                        NIT: {acc.nit_base}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                            {loading && accounts.length > 0 && (
                                <div className="flex justify-center p-4 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
