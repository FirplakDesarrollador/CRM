-- 20261023110000_add_setter_to_oportunidades.sql
-- Campo opcional Setter para oportunidades ('CO', 'REC', o NULL) con auditoría

ALTER TABLE public."CRM_Oportunidades" ADD COLUMN IF NOT EXISTS "setter" TEXT NULL;

-- Actualizar trigger de auditoría para incluir el campo setter
CREATE OR REPLACE FUNCTION public.trg_audit_opportunity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_old_label TEXT;
    v_new_label TEXT;
BEGIN
    v_user_id := COALESCE(auth.uid(), NEW.updated_by);
    v_user_name := public.get_audit_user_name(v_user_id);

    -- 1. Fase
    IF (OLD.fase_id IS DISTINCT FROM NEW.fase_id) THEN
        SELECT nombre INTO v_old_label FROM public."CRM_FasesOportunidad" WHERE id = OLD.fase_id;
        SELECT nombre INTO v_new_label FROM public."CRM_FasesOportunidad" WHERE id = NEW.fase_id;
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'fase_id', 'Fase', COALESCE(v_old_label, OLD.fase_id::text), COALESCE(v_new_label, NEW.fase_id::text), v_user_id, v_user_name);
    END IF;

    -- 2. Estado
    IF (OLD.estado_id IS DISTINCT FROM NEW.estado_id) THEN
        SELECT nombre INTO v_old_label FROM public."CRM_EstadosOportunidad" WHERE id = OLD.estado_id;
        SELECT nombre INTO v_new_label FROM public."CRM_EstadosOportunidad" WHERE id = NEW.estado_id;
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'estado_id', 'Estado', COALESCE(v_old_label, OLD.estado_id::text), COALESCE(v_new_label, NEW.estado_id::text), v_user_id, v_user_name);
    END IF;

    -- 3. Asesor Asignado (Owner)
    IF (OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id) THEN
        v_old_label := public.get_audit_user_name(OLD.owner_user_id);
        v_new_label := public.get_audit_user_name(NEW.owner_user_id);
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'owner_user_id', 'Vendedor Asignado', v_old_label, v_new_label, v_user_id, v_user_name);
    END IF;

    -- 4. Valor / Monto
    IF (OLD.amount IS DISTINCT FROM NEW.amount) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'amount', 'Valor Oportunidad', '$' || COALESCE(OLD.amount::text, '0'), '$' || COALESCE(NEW.amount::text, '0'), v_user_id, v_user_name);
    END IF;

    -- 5. Razón de Pérdida
    IF (OLD.razon_perdida IS DISTINCT FROM NEW.razon_perdida OR OLD.razon_perdida_id IS DISTINCT FROM NEW.razon_perdida_id) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'razon_perdida', 'Motivo de Pérdida', OLD.razon_perdida, NEW.razon_perdida, v_user_id, v_user_name);
    END IF;

    -- 6. Nombre de la Oportunidad
    IF (OLD.nombre IS DISTINCT FROM NEW.nombre) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'nombre', 'Nombre', OLD.nombre, NEW.nombre, v_user_id, v_user_name);
    END IF;

    -- 7. Fecha de Cierre Estimada
    IF (OLD.fecha_cierre_estimada IS DISTINCT FROM NEW.fecha_cierre_estimada) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'fecha_cierre_estimada', 'Fecha de Cierre Estimada', OLD.fecha_cierre_estimada::text, NEW.fecha_cierre_estimada::text, v_user_id, v_user_name);
    END IF;

    -- 8. Probabilidad
    IF (OLD.probabilidad IS DISTINCT FROM NEW.probabilidad) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'probabilidad', 'Probabilidad', OLD.probabilidad::text || '%', NEW.probabilidad::text || '%', v_user_id, v_user_name);
    END IF;

    -- 9. Comentarios de Pérdida
    IF (OLD.comentarios_perdida IS DISTINCT FROM NEW.comentarios_perdida) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'comentarios_perdida', 'Comentarios de Pérdida', OLD.comentarios_perdida, NEW.comentarios_perdida, v_user_id, v_user_name);
    END IF;

    -- 10. Eliminación Lógica
    IF (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'is_deleted', 'Estado en Sistema', CASE WHEN OLD.is_deleted THEN 'Eliminado' ELSE 'Activo' END, CASE WHEN NEW.is_deleted THEN 'Eliminado' ELSE 'Activo' END, v_user_id, v_user_name);
    END IF;

    -- 11. Setter
    IF (OLD.setter IS DISTINCT FROM NEW.setter) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'setter', 'Setter', COALESCE(OLD.setter, '(Ninguna)'), COALESCE(NEW.setter, '(Ninguna)'), v_user_id, v_user_name);
    END IF;

    RETURN NEW;
END;
$$;
