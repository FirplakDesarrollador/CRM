"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
    Command,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInput,
    CommandEmpty,
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
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    emptyText = "No se encontraron resultados.",
    disabled = false,
    className,
    triggerClassName,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);

    const selectedOption = options.find((option) => option.value === value);

    return (
        <Popover open={open && !disabled} onOpenChange={(next) => !disabled && setOpen(next)}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "flex min-h-[42px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 transition-colors text-left",
                        triggerClassName
                    )}
                >
                    <span className={cn("truncate flex-1 mr-2", !selectedOption && "text-slate-400 font-normal")}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 text-slate-500" />
                </button>
            </PopoverTrigger>
            <PopoverContent 
                className={cn(
                    "w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[calc(100vw-2rem)] p-0 z-50 shadow-xl border border-slate-200 rounded-xl overflow-hidden bg-white", 
                    className
                )} 
                align="start"
                sideOffset={4}
            >
                <Command className="w-full" filter={(value, search) => matchesSearchTokens(value, search) ? 1 : 0}>
                    <CommandInput placeholder={searchPlaceholder} className="text-base sm:text-sm h-10" />
                    <CommandList className="max-h-60 overflow-y-auto overscroll-contain">
                        <CommandEmpty className="py-4 text-center text-xs text-slate-500">
                            {emptyText}
                        </CommandEmpty>
                        <CommandGroup className="p-1">
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
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
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

