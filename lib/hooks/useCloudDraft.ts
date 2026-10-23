"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { supabase } from "@/lib/supabase";

export interface CloudDraftPayload<T, E = Record<string, unknown>> {
    formValues: T;
    extraState?: E;
    updatedAt: string;
}

interface UseCloudDraftOptions<T extends FieldValues, E = Record<string, unknown>> {
    form: UseFormReturn<T>;
    formKey: string;
    userId?: string | null;
    extraState?: E;
    hasContent: (values: T, extra?: E) => boolean;
    onRestore: (draft: CloudDraftPayload<T, E>) => void;
    onDiscard: () => void;
    debounceMs?: number;
    enabled?: boolean;
}

export function useCloudDraft<T extends FieldValues, E = Record<string, unknown>>({
    form,
    formKey,
    userId,
    extraState,
    hasContent,
    onRestore,
    onDiscard,
    debounceMs = 800,
    enabled = true,
}: UseCloudDraftOptions<T, E>) {
    const [pendingDraft, setPendingDraft] = useState<CloudDraftPayload<T, E> | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [hasActiveDraft, setHasActiveDraft] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
    const [isDiscarding, setIsDiscarding] = useState(false);

    // Refs
    const isHydratedRef = useRef(false);
    const hasPromptedRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedHashRef = useRef<string>("");
    const extraStateRef = useRef(extraState);
    const formRef = useRef(form);
    const onRestoreRef = useRef(onRestore);
    const onDiscardRef = useRef(onDiscard);
    const hasContentRef = useRef(hasContent);

    useEffect(() => {
        extraStateRef.current = extraState;
        formRef.current = form;
        onRestoreRef.current = onRestore;
        onDiscardRef.current = onDiscard;
        hasContentRef.current = hasContent;
    }, [extraState, form, onRestore, onDiscard, hasContent]);

    const getLocalDraftKey = useCallback((uid?: string | null) => {
        return "crm_cloud_draft_" + formKey + "_" + (uid || "anon");
    }, [formKey]);

    // 1. Detección y Carga Inicial de Borrador (Supabase + LocalStorage)
    useEffect(() => {
        if (!enabled || hasPromptedRef.current) return;

        let isCancelled = false;

        async function checkForDraft() {
            try {
                let candidateDraft: CloudDraftPayload<T, E> | null = null;

                // A. Revisar LocalStorage primero para respuesta inmediata
                const localKey = getLocalDraftKey(userId);
                const localRaw = typeof window !== "undefined" ? localStorage.getItem(localKey) : null;
                if (localRaw) {
                    try {
                        const parsed = JSON.parse(localRaw) as CloudDraftPayload<T, E>;
                        if (parsed && parsed.formValues) {
                            candidateDraft = parsed;
                        }
                    } catch (e) {
                        console.warn("[useCloudDraft] Error parsing local draft:", e);
                    }
                }

                // B. Si tenemos userId y conexión, consultar Supabase
                if (userId && typeof navigator !== "undefined" && navigator.onLine) {
                    const { data, error } = await supabase
                        .from("CRM_FormDrafts")
                        .select("data, updated_at")
                        .eq("user_id", userId)
                        .eq("form_key", formKey)
                        .maybeSingle();

                    if (!isCancelled && !error && data && data.data) {
                        const remoteDraft = data.data as CloudDraftPayload<T, E>;
                        // Si no hay local, o el remoto es más reciente, usar el remoto
                        if (!candidateDraft || !candidateDraft.updatedAt || 
                            (data.updated_at && new Date(data.updated_at).getTime() >= new Date(candidateDraft.updatedAt).getTime())) {
                            candidateDraft = {
                                ...remoteDraft,
                                updatedAt: remoteDraft.updatedAt || data.updated_at
                            };
                            // Sincronizar cache local
                            try {
                                localStorage.setItem(localKey, JSON.stringify(candidateDraft));
                            } catch {}
                        }
                    }
                }

                if (isCancelled) return;

                // C. Verificar si el borrador candidato tiene contenido real
                if (candidateDraft && hasContentRef.current(candidateDraft.formValues, candidateDraft.extraState)) {
                    hasPromptedRef.current = true;
                    setPendingDraft(candidateDraft);
                    setShowPrompt(true);
                } else {
                    // No hay borrador previo válido
                    hasPromptedRef.current = true;
                    isHydratedRef.current = true;
                }
            } catch (err) {
                console.error("[useCloudDraft] Error checking for draft:", err);
                hasPromptedRef.current = true;
                isHydratedRef.current = true;
            }
        }

        checkForDraft();

        return () => {
            isCancelled = true;
        };
    }, [enabled, userId, formKey, getLocalDraftKey]);

    // Función interna para persistir
    const persistDraft = useCallback(async (currentValues: T, currentExtra?: E) => {
        if (!hasContentRef.current(currentValues, currentExtra)) {
            return;
        }

        const payload: CloudDraftPayload<T, E> = {
            formValues: currentValues,
            extraState: currentExtra,
            updatedAt: new Date().toISOString()
        };

        const serialized = JSON.stringify(payload);
        if (serialized === lastSavedHashRef.current) {
            return;
        }

        setSaveStatus("saving");

        // 1. Guardar en localStorage de inmediato
        try {
            const localKey = getLocalDraftKey(userId);
            localStorage.setItem(localKey, serialized);
        } catch (e) {
            console.warn("[useCloudDraft] LocalStorage write error:", e);
        }

        // 2. Guardar en Supabase
        if (userId && typeof navigator !== "undefined" && navigator.onLine) {
            try {
                const { error } = await supabase
                    .from("CRM_FormDrafts")
                    .upsert({
                        user_id: userId,
                        form_key: formKey,
                        data: payload,
                        updated_at: payload.updatedAt
                    }, { onConflict: "user_id,form_key" });

                if (error) {
                    console.warn("[useCloudDraft] Supabase upsert error:", error);
                    setSaveStatus("error");
                } else {
                    lastSavedHashRef.current = serialized;
                    setSaveStatus("saved");
                    setHasActiveDraft(true);
                }
            } catch (supaErr) {
                console.warn("[useCloudDraft] Supabase write exception:", supaErr);
                setSaveStatus("error");
            }
        } else {
            lastSavedHashRef.current = serialized;
            setSaveStatus("saved");
            setHasActiveDraft(true);
        }
    }, [userId, formKey, getLocalDraftKey]);

    // 2. Observar cambios en el formulario y extraState para Guardado Automático Continuo
    useEffect(() => {
        if (!enabled) return;

        const subscription = form.watch((values) => {
            // Solo guardar si ya pasó la etapa de verificación de borrador existente
            if (!isHydratedRef.current || showPrompt) return;

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                const currentValues = formRef.current.getValues();
                persistDraft(currentValues, extraStateRef.current);
            }, debounceMs);
        });

        return () => {
            subscription.unsubscribe();
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
                // Guardar cambios pendientes al desmontar (por ejemplo al cambiar de módulo)
                const currentValues = formRef.current.getValues();
                if (isHydratedRef.current && !showPrompt) {
                    persistDraft(currentValues, extraStateRef.current);
                }
            }
        };
    }, [enabled, form, showPrompt, debounceMs, persistDraft]);

    // Observar cambios específicos en extraState (ej. cuenta seleccionada)
    const prevExtraStateStr = useRef<string>(JSON.stringify(extraState));
    useEffect(() => {
        if (!enabled || !isHydratedRef.current || showPrompt) return;
        const currentExtraStr = JSON.stringify(extraState);
        if (currentExtraStr !== prevExtraStateStr.current) {
            prevExtraStateStr.current = currentExtraStr;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                const currentValues = formRef.current.getValues();
                persistDraft(currentValues, extraState);
            }, debounceMs);
        }
    }, [extraState, enabled, showPrompt, debounceMs, persistDraft]);

    // Respaldo de emergencia en beforeunload (F5 o cierre intempestivo de pestaña)
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isHydratedRef.current && !showPrompt) {
                const currentValues = formRef.current.getValues();
                if (hasContentRef.current(currentValues, extraStateRef.current)) {
                    const payload: CloudDraftPayload<T, E> = {
                        formValues: currentValues,
                        extraState: extraStateRef.current,
                        updatedAt: new Date().toISOString()
                    };
                    try {
                        localStorage.setItem(getLocalDraftKey(userId), JSON.stringify(payload));
                    } catch {}
                }
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [userId, showPrompt, getLocalDraftKey]);

    // 3. Acción: Continuar con Registro Existente
    const continueExistingDraft = useCallback(() => {
        if (!pendingDraft) return;

        // Restaurar estado del formulario y extraState
        onRestoreRef.current(pendingDraft);

        lastSavedHashRef.current = JSON.stringify(pendingDraft);
        setHasActiveDraft(true);
        setShowPrompt(false);
        setPendingDraft(null);
        isHydratedRef.current = true;
    }, [pendingDraft]);

    // 4. Acción: Crear Uno Nuevo (Descartar y borrar borrador)
    const discardAndCreateNew = useCallback(async () => {
        setIsDiscarding(true);
        try {
            // A. Borrar de Supabase
            if (userId && typeof navigator !== "undefined" && navigator.onLine) {
                await supabase
                    .from("CRM_FormDrafts")
                    .delete()
                    .eq("user_id", userId)
                    .eq("form_key", formKey);
            }

            // B. Borrar de LocalStorage
            const localKey = getLocalDraftKey(userId);
            if (typeof window !== "undefined") {
                localStorage.removeItem(localKey);
            }

            // C. Resetear formulario a limpio
            onDiscardRef.current();

            lastSavedHashRef.current = "";
            setHasActiveDraft(false);
            setPendingDraft(null);
            setShowPrompt(false);
            isHydratedRef.current = true;
        } catch (err) {
            console.error("[useCloudDraft] Error discarding draft:", err);
        } finally {
            setIsDiscarding(false);
        }
    }, [userId, formKey, getLocalDraftKey]);

    // 5. Acción: Limpiar Borrador Exitosamente (Llamado tras 'Crear Registro')
    const clearDraft = useCallback(async () => {
        try {
            if (userId && typeof navigator !== "undefined" && navigator.onLine) {
                await supabase
                    .from("CRM_FormDrafts")
                    .delete()
                    .eq("user_id", userId)
                    .eq("form_key", formKey);
            }

            const localKey = getLocalDraftKey(userId);
            if (typeof window !== "undefined") {
                localStorage.removeItem(localKey);
            }

            lastSavedHashRef.current = "";
            setHasActiveDraft(false);
            setPendingDraft(null);
        } catch (err) {
            console.error("[useCloudDraft] Error clearing draft on submit:", err);
        }
    }, [userId, formKey, getLocalDraftKey]);

    return {
        showPrompt,
        pendingDraft,
        hasActiveDraft,
        saveStatus,
        isDiscarding,
        continueExistingDraft,
        discardAndCreateNew,
        clearDraft
    };
}
