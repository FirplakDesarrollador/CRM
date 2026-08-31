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

    // Callers commonly pass an inline callback. Keeping the latest callback in a
    // ref prevents every render from tearing down the watcher and cancelling a
    // pending autosave timer.
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
                    const errors = form.formState.errors;
                    const firstErrorKey = Object.keys(errors)[0];
                    const firstErrorMessage = firstErrorKey
                        ? (errors[firstErrorKey as keyof typeof errors]?.message as string)
                        : "Error de validación en el formulario";
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
