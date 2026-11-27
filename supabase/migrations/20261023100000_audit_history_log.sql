-- 20261023100000_audit_history_log.sql
-- Trazabilidad y log unificado de modificaciones para Oportunidades, Cuentas y Contactos

-- 1. Tabla de Auditoría Unificada
CREATE TABLE IF NOT EXISTS public."CRM_HistorialModificaciones" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('OPORTUNIDAD', 'CUENTA', 'CONTACTO')),
    entity_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES public."CRM_Usuarios"(id) ON DELETE SET NULL,
    changed_by_name TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_historial_mod_entity 
ON public."CRM_HistorialModificaciones"(entity_type, entity_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_historial_mod_changed_by 
ON public."CRM_HistorialModificaciones"(changed_by);

-- RLS
ALTER TABLE public."CRM_HistorialModificaciones" ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'CRM_HistorialModificaciones' 
        AND policyname = 'Allow all read CRM_HistorialModificaciones'
    ) THEN
        CREATE POLICY "Allow all read CRM_HistorialModificaciones"
        ON public."CRM_HistorialModificaciones"
        FOR SELECT
        TO public
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'CRM_HistorialModificaciones' 
        AND policyname = 'Allow system insert CRM_HistorialModificaciones'
    ) THEN
        CREATE POLICY "Allow system insert CRM_HistorialModificaciones"
        ON public."CRM_HistorialModificaciones"
        FOR INSERT
        TO public
        WITH CHECK (true);
    END IF;
END $$;

-- Función auxiliar para obtener nombre del usuario
CREATE OR REPLACE FUNCTION public.get_audit_user_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(NULLIF(full_name, ''), email, 'Usuario ' || p_user_id::text)
    FROM public."CRM_Usuarios"
    WHERE id = p_user_id
    LIMIT 1;
$$;

-- Trigger Oportunidades
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

    -- 4. Valor (Importe)
    IF (OLD.amount IS DISTINCT FROM NEW.amount) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'amount', 'Valor Oportunidad', OLD.amount::text, NEW.amount::text, v_user_id, v_user_name);
    END IF;

    -- 5. Razón de Pérdida
    IF (OLD.razon_perdida IS DISTINCT FROM NEW.razon_perdida) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'razon_perdida', 'Razón de Pérdida', OLD.razon_perdida, NEW.razon_perdida, v_user_id, v_user_name);
    END IF;

    -- 6. Nombre
    IF (OLD.nombre IS DISTINCT FROM NEW.nombre) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('OPORTUNIDAD', NEW.id, 'nombre', 'Nombre Oportunidad', OLD.nombre, NEW.nombre, v_user_id, v_user_name);
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_opportunity_changes ON public."CRM_Oportunidades";
CREATE TRIGGER trg_audit_opportunity_changes
AFTER UPDATE ON public."CRM_Oportunidades"
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_opportunity_changes();

-- Trigger Cuentas
CREATE OR REPLACE FUNCTION public.trg_audit_account_changes_full()
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

    -- 1. Nombre Cuenta
    IF (OLD.nombre IS DISTINCT FROM NEW.nombre) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'nombre', 'Nombre Cuenta', OLD.nombre, NEW.nombre, v_user_id, v_user_name);
    END IF;

    -- 2. Vendedor Asignado
    IF (OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id) THEN
        v_old_label := public.get_audit_user_name(OLD.owner_user_id);
        v_new_label := public.get_audit_user_name(NEW.owner_user_id);
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'owner_user_id', 'Vendedor Asignado', v_old_label, v_new_label, v_user_id, v_user_name);
    END IF;

    -- 3. Canal
    IF (OLD.canal_id IS DISTINCT FROM NEW.canal_id) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'canal_id', 'Canal de Venta', OLD.canal_id, NEW.canal_id, v_user_id, v_user_name);
    END IF;

    -- 4. Teléfono
    IF (OLD.telefono IS DISTINCT FROM NEW.telefono) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'telefono', 'Teléfono', OLD.telefono, NEW.telefono, v_user_id, v_user_name);
    END IF;

    -- 5. Email
    IF (OLD.email IS DISTINCT FROM NEW.email) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'email', 'Correo Electrónico', OLD.email, NEW.email, v_user_id, v_user_name);
    END IF;

    -- 6. NIT
    IF (OLD.nit IS DISTINCT FROM NEW.nit) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'nit', 'NIT / Documento', OLD.nit, NEW.nit, v_user_id, v_user_name);
    END IF;

    -- 7. Dirección
    IF (OLD.direccion IS DISTINCT FROM NEW.direccion) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'direccion', 'Dirección', OLD.direccion, NEW.direccion, v_user_id, v_user_name);
    END IF;

    -- 8. Ciudad
    IF (OLD.ciudad IS DISTINCT FROM NEW.ciudad) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'ciudad', 'Ciudad', OLD.ciudad, NEW.ciudad, v_user_id, v_user_name);
    END IF;

    -- 9. Eliminación Lógica
    IF (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CUENTA', NEW.id, 'is_deleted', 'Estado en Sistema', CASE WHEN OLD.is_deleted THEN 'Eliminada' ELSE 'Activa' END, CASE WHEN NEW.is_deleted THEN 'Eliminada' ELSE 'Activa' END, v_user_id, v_user_name);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_account_changes_full ON public."CRM_Cuentas";
CREATE TRIGGER trg_audit_account_changes_full
AFTER UPDATE ON public."CRM_Cuentas"
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_account_changes_full();

-- Trigger Contactos
CREATE OR REPLACE FUNCTION public.trg_audit_contact_changes_full()
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

    -- 1. Nombre Contacto
    IF (OLD.nombre IS DISTINCT FROM NEW.nombre) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'nombre', 'Nombre Contacto', OLD.nombre, NEW.nombre, v_user_id, v_user_name);
    END IF;

    -- 2. Cargo
    IF (OLD.cargo IS DISTINCT FROM NEW.cargo) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'cargo', 'Cargo', OLD.cargo, NEW.cargo, v_user_id, v_user_name);
    END IF;

    -- 3. Teléfono
    IF (OLD.telefono IS DISTINCT FROM NEW.telefono) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'telefono', 'Teléfono', OLD.telefono, NEW.telefono, v_user_id, v_user_name);
    END IF;

    -- 4. Email
    IF (OLD.email IS DISTINCT FROM NEW.email) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'email', 'Correo Electrónico', OLD.email, NEW.email, v_user_id, v_user_name);
    END IF;

    -- 5. Cuenta Vinculada
    IF (OLD.account_id IS DISTINCT FROM NEW.account_id) THEN
        SELECT nombre INTO v_old_label FROM public."CRM_Cuentas" WHERE id = OLD.account_id;
        SELECT nombre INTO v_new_label FROM public."CRM_Cuentas" WHERE id = NEW.account_id;
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'account_id', 'Cuenta Vinculada', COALESCE(v_old_label, OLD.account_id::text), COALESCE(v_new_label, NEW.account_id::text), v_user_id, v_user_name);
    END IF;

    -- 6. Es Principal
    IF (OLD.es_principal IS DISTINCT FROM NEW.es_principal) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'es_principal', 'Contacto Principal', CASE WHEN OLD.es_principal THEN 'Sí' ELSE 'No' END, CASE WHEN NEW.es_principal THEN 'Sí' ELSE 'No' END, v_user_id, v_user_name);
    END IF;

    -- 7. Eliminación Lógica
    IF (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
        INSERT INTO public."CRM_HistorialModificaciones" (entity_type, entity_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name)
        VALUES ('CONTACTO', NEW.id, 'is_deleted', 'Estado en Sistema', CASE WHEN OLD.is_deleted THEN 'Eliminado' ELSE 'Activo' END, CASE WHEN NEW.is_deleted THEN 'Eliminado' ELSE 'Activo' END, v_user_id, v_user_name);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_contact_changes_full ON public."CRM_Contactos";
CREATE TRIGGER trg_audit_contact_changes_full
AFTER UPDATE ON public."CRM_Contactos"
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_contact_changes_full();
