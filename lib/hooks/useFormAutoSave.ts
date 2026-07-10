import { useEffect, useRef, useState } from "react";
import { UseFormReturn } from "react-hook-form";

interface AutoSaveConfig<T> {
    form: UseFormReturn<T>;
    onSave: (data: T) => Promise<void>;
    debounceMs?: number;
    isEnabled: boolean;
}

export function useFormAutoSave<T extends object>({
    form,
    onSave,
    debounceMs = 1500,
    isEnabled
}: AutoSaveConfig<T>) {
    const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
    const lastSavedData = useRef<string>("");

    // Initialize lastSavedData when hook is mounted or enabled
    useEffect(() => {
        if (isEnabled) {
            lastSavedData.current = JSON.stringify(form.getValues());
        }
    }, [isEnabled, form]);

    useEffect(() => {
        if (!isEnabled) return;

        const subscription = form.watch((value, { name }) => {
            // Avoid saving if value matches last saved snapshot
            const valueStr = JSON.stringify(value);
            if (valueStr === lastSavedData.current) return;

            setStatus("saving");

            const timer = setTimeout(async () => {
                // If form is valid, trigger save
                const isValid = await form.trigger();
                if (isValid) {
                    const currentValues = form.getValues();
                    try {
                        await onSave(currentValues);
                        lastSavedData.current = JSON.stringify(currentValues);
                        setStatus("saved");
                    } catch (err) {
                        console.error("[AutoSave] Error en guardado automático:", err);
                        setStatus("error");
                    }
                } else {
                    setStatus("error");
                }
            }, debounceMs);

            return () => clearTimeout(timer);
        });

        return () => subscription.unsubscribe();
    }, [form, onSave, debounceMs, isEnabled]);

    return { status };
}
export default useFormAutoSave;
