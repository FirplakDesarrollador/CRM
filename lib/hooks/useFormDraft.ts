import { useEffect, useState, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';

/**
 * Hook para guardar y restaurar borradores (drafts) de formularios usando localStorage.
 * 
 * @param form La instancia del formulario (retornada por useForm)
 * @param draftKey La clave única para guardar en localStorage
 * @param isEnabled Indica si el borrador debe guardarse/cargarse
 */
export function useFormDraft<T extends object>(
  form: UseFormReturn<T>,
  draftKey: string,
  isEnabled: boolean = true
) {
  const [hasDraft, setHasDraft] = useState(false);
  const isHydrated = useRef(false);

  // 1. Cargar el borrador al montar el componente
  useEffect(() => {
    if (!isEnabled || isHydrated.current) return;
    
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        // Reseteamos el formulario fusionando sus defaultValues con el borrador guardado
        form.reset({
          ...form.getValues(),
          ...parsed
        } as any);
        setHasDraft(true);
      } catch (e) {
        console.error("Failed to parse form draft", e);
      }
    }
    isHydrated.current = true;
  }, [isEnabled, draftKey, form]);

  // 2. Guardar cambios en el borrador continuamente
  useEffect(() => {
    if (!isEnabled) return;
    
    const subscription = form.watch((value, { name, type }) => {
      // Solo guardar si ya fue hidratado para evitar sobreescribir el borrador
      // 'name' suele estar indefinido cuando es un reset() completo sin interaccion de usuario.
      if (isHydrated.current && name) {
        console.log(`[useFormDraft] Guardando borrador para ${draftKey} debido a campo modificado: ${name}`);
        localStorage.setItem(draftKey, JSON.stringify(value));
      }
    });
    return () => subscription.unsubscribe();
  }, [isEnabled, draftKey, form]);

  // 3. Función para limpiar el borrador (cuando se guarda exitosamente)
  const clearDraft = () => {
    localStorage.removeItem(draftKey);
    setHasDraft(false);
  };

  return { hasDraft, clearDraft };
}
