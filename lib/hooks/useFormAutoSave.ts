import { useEffect, useRef, useState } from "react";
import { FieldValues, UseFormReturn } from "react-hook-form";

interface AutoSaveConfig<T extends FieldValues, TContext = unknown, TTransformedValues = unknown> {
    form: UseFormReturn<T, TContext, TTransformedValues>;
    onSave: (data: T) => Promise<void>;
    debounceMs?: number;
    isEnabled: boolean;
}

export function useFormAutoSave<T extends FieldValues, TContext = unknown, TTransformedValues = unknown>({
    form,
    onSave,
    debounceMs = 600,
    isEnabled
}: AutoSaveConfig<T, TContext, TTransformedValues>) {
    const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const lastSavedData = useRef<string>("");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onSaveRef = useRef(onSave);
    const formRef = useRef(form);

    // Keep refs up-to-date
    useEffect(() => {
        onSaveRef.current = onSave;
        formRef.current = form;
    }, [onSave, form]);

    // Initialize lastSavedData when hook is mounted or enabled
    useEffect(() => {
        if (isEnabled) {
            lastSavedData.current = JSON.stringify(form.getValues());
        }
    }, [isEnabled, form]);

    useEffect(() => {
        if (!isEnabled) return;

        const subscription = form.watch((value) => {
            // Avoid saving if value matches last saved snapshot
            const valueStr = JSON.stringify(value);
            if (valueStr === lastSavedData.current) return;

            setStatus("saving");

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(async () => {
                timerRef.current = null;
                // If form is valid, trigger save
                const isValid = await form.trigger();
                if (isValid) {
                    const currentValues = form.getValues();
                    try {
                        await onSaveRef.current(currentValues);
                        lastSavedData.current = JSON.stringify(currentValues);
                        setStatus("saved");
                        setErrorMessage(null);
                    } catch (err) {
                        console.error("[AutoSave] Error en guardado automático:", err);
                        setStatus("error");
                        setErrorMessage(err instanceof Error ? err.message : String(err));
                    }
                } else {
                    const currentErrors = (form as any).control?._formState?.errors || form.formState.errors || {};
                    const errorKeys = Object.keys(currentErrors);
                    let firstErrorMessage = "";
                    if (errorKeys.length > 0) {
                        const firstKey = errorKeys[0];
                        const errObj = currentErrors[firstKey];
                        if (errObj && typeof errObj === 'object' && 'message' in errObj && typeof errObj.message === 'string') {
                            firstErrorMessage = `${firstKey}: ${errObj.message}`;
                        }
                    }
                    setStatus("error");
                    setErrorMessage(firstErrorMessage || "Error de validación en el formulario");
                }
            }, debounceMs);
        });

        return () => {
            subscription.unsubscribe();
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;

                // Flush pending save immediately on unmount/close so changes are never lost!
                const currentValues = formRef.current.getValues();
                const valueStr = JSON.stringify(currentValues);
                if (valueStr !== lastSavedData.current) {
                    console.log("[AutoSave] Flushing pending changes on unmount...");
                    onSaveRef.current(currentValues).catch(err => {
                        console.error("[AutoSave] Error flushing save on unmount:", err);
                    });
                }
            }
        };
    }, [form, debounceMs, isEnabled]);

    return { status, errorMessage };
}


export default useFormAutoSave;
