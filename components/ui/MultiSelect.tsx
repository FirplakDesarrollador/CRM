"use client";

import * as React from "react";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export type Option = {
    label: string;
    value: string;
};

interface MultiSelectProps {
    options: Option[];
    selected: string[];
    onChange: (selected: string[]) => void;
    className?: string;
    placeholder?: string;
    badgeClassName?: string;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    className,
    placeholder = "Select items...",
    badgeClassName,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex min-h-[42px] w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-[#254153] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                >
                    <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                        {selected.length === 0 && (
                            <span className="text-slate-400 select-none text-left">{placeholder}</span>
                        )}
                        {selected.map((item) => {
                            const option = options.find((o) => o.value === item);
                            return (
                                <Badge
                                    key={item}
                                    variant="secondary"
                                    className={cn("px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80 rounded-md flex items-center gap-1", badgeClassName)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnselect(item);
                                    }}
                                >
                                    <span className="truncate max-w-[180px] sm:max-w-[240px]">{option ? option.label : item}</span>
                                    <button
                                        type="button"
                                        className="ml-0.5 ring-offset-white rounded-full outline-none focus:ring-2 focus:ring-ring hover:bg-slate-300/50 p-0.5"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleUnselect(item);
                                            }
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleUnselect(item);
                                        }}
                                        aria-label={`Eliminar ${option ? option.label : item}`}
                                    >
                                        <X className="h-3 w-3 text-slate-500 hover:text-slate-900" />
                                    </button>
                                </Badge>
                            );
                        })}
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2 text-slate-500" />
                </button>
            </PopoverTrigger>
            <PopoverContent 
                align="start" 
                sideOffset={4} 
                className="w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[calc(100vw-2rem)] p-0 z-50 shadow-xl border border-slate-200 rounded-xl overflow-hidden bg-white"
            >
                <Command className="w-full">
                    <CommandInput placeholder="Buscar categoría..." className="text-base sm:text-sm h-10" />
                    <CommandList className="max-h-60 overflow-y-auto overscroll-contain">
                        <CommandEmpty className="py-4 text-center text-xs text-slate-500">
                            No se encontraron resultados.
                        </CommandEmpty>
                        <CommandGroup className="p-1">
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onChange(
                                            selected.includes(option.value)
                                                ? selected.filter((item) => item !== option.value)
                                                : [...selected, option.value]
                                        );
                                        setOpen(true);
                                    }}
                                    className="flex items-center justify-between px-3 py-2.5 sm:py-2 text-sm rounded-lg cursor-pointer hover:bg-slate-100/80 active:bg-slate-200/80 transition-colors"
                                >
                                    <span className="font-medium text-slate-800">{option.label}</span>
                                    <Check
                                        className={cn(
                                            "h-4 w-4 text-blue-600 shrink-0 ml-2",
                                            selected.includes(option.value)
                                                ? "opacity-100"
                                                : "opacity-0"
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
