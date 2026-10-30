"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/components/ui/utils";

/**
 * Textarea de comentarios que conserva su tamaño por defecto (según `rows`)
 * pero se puede ampliar:
 *  - arrastrando la esquina (resize vertical, en escritorio), o
 *  - con el botón "Ampliar", que la hace crecer al alto del texto
 *    (máx. 70% de la pantalla) y sigue creciendo mientras se escribe.
 *    "Reducir" la devuelve a su tamaño original.
 *
 * Funciona controlada (value/onChange) o con react-hook-form (`register`),
 * porque reenvía el ref.
 */
export interface ExpandableTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** Clases extra para el contenedor. */
    wrapperClassName?: string;
}

const MAX_VH = 0.7;

export const ExpandableTextarea = React.forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
    function ExpandableTextarea({ className, wrapperClassName, onInput, value, ...props }, forwardedRef) {
        const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
        const [expanded, setExpanded] = React.useState(false);

        const setRefs = React.useCallback(
            (el: HTMLTextAreaElement | null) => {
                innerRef.current = el;
                if (typeof forwardedRef === "function") forwardedRef(el);
                else if (forwardedRef) forwardedRef.current = el;
            },
            [forwardedRef]
        );

        const fit = React.useCallback(() => {
            const el = innerRef.current;
            if (!el) return;
            const max = typeof window !== "undefined" ? window.innerHeight * MAX_VH : 600;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
        }, []);

        // Si el valor cambia desde fuera (sincronización) mientras está ampliada, reajustar.
        React.useEffect(() => {
            if (expanded) fit();
        }, [expanded, value, fit]);

        const toggle = () => {
            const el = innerRef.current;
            if (expanded) {
                if (el) el.style.height = "";
                setExpanded(false);
            } else {
                setExpanded(true);
                fit();
            }
        };

        return (
            <div className={cn("w-full", wrapperClassName)}>
                <textarea
                    ref={setRefs}
                    value={value}
                    onInput={(e) => {
                        if (expanded) fit();
                        onInput?.(e);
                    }}
                    {...props}
                    className={cn(
                        className,
                        "block resize-y min-h-[2.5rem] max-h-[70vh] overflow-y-auto"
                    )}
                />
                <div className="flex justify-end mt-1">
                    <button
                        type="button"
                        // No quitar el foco del texto al tocar el botón.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={toggle}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 px-1.5 py-1 rounded transition-colors"
                    >
                        {expanded ? (
                            <>
                                <Minimize2 className="w-3 h-3" /> Reducir
                            </>
                        ) : (
                            <>
                                <Maximize2 className="w-3 h-3" /> Ampliar
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }
);
