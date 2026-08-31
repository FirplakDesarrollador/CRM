import { useEffect, useRef, useState } from "react";
import { FieldValues, UseFormReturn } from "react-hook-form";

interface AutoSaveConfig<T extends FieldValues> {
    form: UseFormReturn<T>;
    onSave: (data: T) => Promise<void>;
    debounceMs?: number;
    isEnabled: boolean;
}

export function useFormAutoSave<T extends FieldValues>({
    form,
    onSave,
    debounceMs = 1500,
    isEnabled
}: AutoSaveConfig<T>) {
    const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const lastSavedData = useRef<string>("");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onSaveRef = useRef(onSave);

    // Subscribe to errors proxy so react-hook-form populates formState.errors
    const formErrors = form.formState.errors;

    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

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
            }
        };
    }, [form, debounceMs, isEnabled]);

    return { status, errorMessage };
}


export default useFormAutoSave;
