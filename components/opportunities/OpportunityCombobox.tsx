"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpportunitiesServer } from "@/lib/hooks/useOpportunitiesServer";
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

interface OpportunityComboboxProps {
    value?: string;
    accountId?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export function OpportunityCombobox({
    value,
    accountId,
    onChange,
    disabled = false
}: OpportunityComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    // Default page size for infinite scroll
    const {
        data: opportunities,
        loading,
        hasMore,
        loadMore,
        setSearchTerm,
        setUserFilter,
        setAccountIdFilter
    } = useOpportunitiesServer({ pageSize: 20 });

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

    // Set filters on mount or when accountId changes
    React.useEffect(() => {
        setUserFilter('team');
        setAccountIdFilter(accountId || null);
    }, [setUserFilter, setAccountIdFilter, accountId]);

    // Handle Search with simple debounce inside effect if no useDebounce hook exists
    React.useEffect(() => {
        const timeout = setTimeout(() => {
            setSearchTerm(search);
        }, 300);
        return () => clearTimeout(timeout);
    }, [search, setSearchTerm]);

    const selectedOpp = React.useMemo(() => {
        return opportunities.find(o => o.id === value);
    }, [value, opportunities]);

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
                        {value && selectedOpp ? selectedOpp.nombre : "Seleccione una oportunidad..."}
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
                            placeholder="Buscar oportunidad..."
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
                                "No se encontraron oportunidades."
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {opportunities.map((opp, index) => {
                                const isLast = index === opportunities.length - 1;
                                return (
                                    <CommandItem
                                        key={opp.id}
                                        value={opp.id}
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
                                                    "mr-2 h-4 w-4",
                                                    value === opp.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="truncate">{opp.nombre}</span>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                            {loading && opportunities.length > 0 && (
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
