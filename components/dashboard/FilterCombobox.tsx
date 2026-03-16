"use client";

import { useState, useRef, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FilterComboboxProps {
    options: { value: string | number; label: string }[];
    value: string | number | null | undefined;
    onChange: (value: string | number | null) => void;
    placeholder: string;
    className?: string;
}

export function FilterCombobox({ options, value, onChange, placeholder, className }: FilterComboboxProps) {
    const [open, setOpen] = useState(false);
    const selectedOption = options.find((opt) => opt.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full md:w-auto justify-between bg-white text-slate-700 font-normal pr-3 pl-3", className)}
                >
                    {selectedOption ? (
                        <span className="truncate max-w-[150px]">{selectedOption.label}</span>
                    ) : (
                        <span className="text-slate-500 font-normal truncate max-w-[150px]">
                            {placeholder}
                        </span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Buscar ${placeholder.toLowerCase()}...`} />
                    <CommandList>
                        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                        <CommandGroup>
                            {/* Option to clear visually, or allow clicking the button when selected */}
                            {value !== null && value !== undefined && value !== '' && (
                                <CommandItem
                                    className="text-slate-500 italic"
                                    onSelect={() => {
                                        onChange(null);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className="mr-2 h-4 w-4 opacity-0" />
                                    Ninguno
                                </CommandItem>
                            )}
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
