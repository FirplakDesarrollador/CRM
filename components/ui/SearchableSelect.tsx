"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInput,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import { matchesSearchTokens } from "@/lib/utils";

export interface SearchableSelectOption {
    label: string;
    value: string;
    searchValue?: string;
    disabled?: boolean;
}

export interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    allowClear?: boolean;
    className?: string;
    triggerClassName?: string;
    id?: string;
    dataTestId?: string;
    ariaLabel?: string;
    fallbackLabel?: string;
    compact?: boolean;
    maxVisibleOptions?: number;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    emptyText = "No se encontraron resultados.",
    disabled = false,
    allowClear = true,
    className,
    triggerClassName,
    id,
    dataTestId,
    ariaLabel,
    fallbackLabel,
    compact = false,
    maxVisibleOptions = 200,
}: SearchableSelectProps) {
    const listboxId = React.useId();
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const selectedOption = React.useMemo(
        () => options.find((option) => option.value === value),
        [options, value]
    );

    const filteredOptions = React.useMemo(() => {
        if (!search.trim()) return options;
        return options.filter((option) =>
            matchesSearchTokens([option.label, option.searchValue], search)
        );
    }, [options, search]);

    const visibleOptions = React.useMemo(
        () => filteredOptions.slice(0, maxVisibleOptions),
        [filteredOptions, maxVisibleOptions]
    );

    const isTruncated = filteredOptions.length > maxVisibleOptions;

    const handleOpenChange = (next: boolean) => {
        if (disabled) return;
        setOpen(next);
        if (!next) {
            setSearch("");
        }
    };

    const displayLabel = selectedOption
        ? selectedOption.label
        : value && fallbackLabel
            ? fallbackLabel
            : placeholder;

    const hasDisplayValue = Boolean(selectedOption || (value && fallbackLabel));

    return (
        <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    role="combobox"
                    aria-expanded={open && !disabled}
                    aria-controls={listboxId}
                    aria-label={ariaLabel}
                    data-testid={dataTestId}
                    disabled={disabled}
                    className={cn(
                        compact
                            ? "flex min-h-[34px] w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 transition-colors text-left"
                            : "flex min-h-[42px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 transition-colors text-left",
                        triggerClassName
                    )}
                >
                    <span className={cn("truncate flex-1 mr-2", !hasDisplayValue && "text-slate-400 font-normal")}>
                        {displayLabel}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                        {allowClear && !!value && !disabled && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onChange("");
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
                className={cn(
                    "w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-[calc(100vw-2rem)] p-0 z-[110] shadow-xl border border-slate-200 rounded-xl overflow-hidden bg-white",
                    className
                )}
                align="start"
                sideOffset={4}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                    }
                }}
            >
                <Command className="w-full" shouldFilter={false}>
                    <CommandInput
                        value={search}
                        onValueChange={setSearch}
                        placeholder={searchPlaceholder}
                        className="text-base sm:text-sm h-10"
                    />
                    <CommandList
                        id={listboxId}
                        className="max-h-60 overflow-y-auto overscroll-contain"
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        {visibleOptions.length === 0 ? (
                            <div className="py-4 px-3 text-center text-xs text-slate-500">
                                {emptyText}
                            </div>
                        ) : (
                            <CommandGroup className="p-1">
                                {visibleOptions.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        disabled={option.disabled}
                                        onSelect={() => {
                                            if (option.disabled) return;
                                            onChange(allowClear && value === option.value ? "" : option.value);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                        className="flex items-center justify-between px-3 py-2.5 sm:py-2 text-sm rounded-lg cursor-pointer hover:bg-slate-100/80 active:bg-slate-200/80 transition-colors"
                                    >
                                        <span className={cn("truncate flex-1", value === option.value ? "font-semibold text-blue-900" : "font-normal text-slate-800")}>
                                            {option.label}
                                        </span>
                                        <Check
                                            className={cn(
                                                "h-4 w-4 text-blue-600 shrink-0 ml-2",
                                                value === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                                {isTruncated && (
                                    <div className="px-3 py-2 text-center text-[11px] text-slate-400 border-t border-slate-100 mt-1">
                                        Mostrando primeros {maxVisibleOptions} de {filteredOptions.length}. Escribe para refinar...
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
