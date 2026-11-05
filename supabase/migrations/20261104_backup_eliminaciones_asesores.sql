-- Backup de eliminaciones (cuentas, oportunidades, contactos) - 2026-11-04

CREATE OR REPLACE FUNCTION public.crm_puede_ver_eliminaciones()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public."CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role IN ('ADMIN','COORDINADOR') AND coalesce(u.is_active,true));
$$;
REVOKE ALL ON FUNCTION public.crm_puede_ver_eliminaciones() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_puede_ver_eliminaciones() TO authenticated;

CREATE TABLE public."CRM_Backup_Cuentas_Eliminadas_Asesores" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL,
  tabla_origen text NOT NULL,
  nombre_registro text,
  cuenta_id uuid,
  snapshot jsonb NOT NULL,
  eliminado_por uuid,
  eliminado_por_nombre text,
  eliminado_por_email text,
  eliminado_por_rol text,
  fecha_eliminacion timestamptz NOT NULL DEFAULT now(),
  resultado text NOT NULL CHECK (resultado IN ('EXITOSO','FALLIDO')),
  motivo_fallo text,
  origen_accion text NOT NULL DEFAULT 'UI' CHECK (origen_accion IN ('UI','SYNC_OFFLINE','CASCADA_CUENTA','SISTEMA')),
  eliminacion_padre_id uuid,
  restaurado boolean NOT NULL DEFAULT false,
  restaurado_por uuid,
  fecha_restauracion timestamptz
);
CREATE INDEX idx_bk_cta_asesor_fecha ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" (eliminado_por, fecha_eliminacion DESC);
CREATE INDEX idx_bk_cta_registro ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" (registro_id);
CREATE INDEX idx_bk_cta_resultado_fecha ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" (resultado, fecha_eliminacion DESC);
ALTER TABLE public."CRM_Backup_Cuentas_Eliminadas_Asesores" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" FROM authenticated;
GRANT SELECT ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" TO authenticated;
CREATE POLICY "Lectura solo admin y coordinador" ON public."CRM_Backup_Cuentas_Eliminadas_Asesores" FOR SELECT TO authenticated USING (public.crm_puede_ver_eliminaciones());

CREATE TABLE public."CRM_Backup_Oportunidades_Eliminadas_Asesores" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL,
  tabla_origen text NOT NULL,
  nombre_registro text,
  cuenta_id uuid,
  snapshot jsonb NOT NULL,
  eliminado_por uuid,
  eliminado_por_nombre text,
  eliminado_por_email text,
  eliminado_por_rol text,
  fecha_eliminacion timestamptz NOT NULL DEFAULT now(),
  resultado text NOT NULL CHECK (resultado IN ('EXITOSO','FALLIDO')),
  motivo_fallo text,
  origen_accion text NOT NULL DEFAULT 'UI' CHECK (origen_accion IN ('UI','SYNC_OFFLINE','CASCADA_CUENTA','SISTEMA')),
  eliminacion_padre_id uuid,
  restaurado boolean NOT NULL DEFAULT false,
  restaurado_por uuid,
  fecha_restauracion timestamptz
);
CREATE INDEX idx_bk_opp_asesor_fecha ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" (eliminado_por, fecha_eliminacion DESC);
CREATE INDEX idx_bk_opp_registro ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" (registro_id);
CREATE INDEX idx_bk_opp_resultado_fecha ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" (resultado, fecha_eliminacion DESC);
ALTER TABLE public."CRM_Backup_Oportunidades_Eliminadas_Asesores" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" FROM authenticated;
GRANT SELECT ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" TO authenticated;
CREATE POLICY "Lectura solo admin y coordinador" ON public."CRM_Backup_Oportunidades_Eliminadas_Asesores" FOR SELECT TO authenticated USING (public.crm_puede_ver_eliminaciones());

CREATE TABLE public."CRM_Backup_Contactos_Eliminados_Asesores" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL,
  tabla_origen text NOT NULL,
  nombre_registro text,
  cuenta_id uuid,
  snapshot jsonb NOT NULL,
  eliminado_por uuid,
  eliminado_por_nombre text,
  eliminado_por_email text,
  eliminado_por_rol text,
  fecha_eliminacion timestamptz NOT NULL DEFAULT now(),
  resultado text NOT NULL CHECK (resultado IN ('EXITOSO','FALLIDO')),
  motivo_fallo text,
  origen_accion text NOT NULL DEFAULT 'UI' CHECK (origen_accion IN ('UI','SYNC_OFFLINE','CASCADA_CUENTA','SISTEMA')),
  eliminacion_padre_id uuid,
  restaurado boolean NOT NULL DEFAULT false,
  restaurado_por uuid,
  fecha_restauracion timestamptz
);
CREATE INDEX idx_bk_con_asesor_fecha ON public."CRM_Backup_Contactos_Eliminados_Asesores" (eliminado_por, fecha_eliminacion DESC);
CREATE INDEX idx_bk_con_registro ON public."CRM_Backup_Contactos_Eliminados_Asesores" (registro_id);
CREATE INDEX idx_bk_con_resultado_fecha ON public."CRM_Backup_Contactos_Eliminados_Asesores" (resultado, fecha_eliminacion DESC);
ALTER TABLE public."CRM_Backup_Contactos_Eliminados_Asesores" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CRM_Backup_Contactos_Eliminados_Asesores" FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public."CRM_Backup_Contactos_Eliminados_Asesores" FROM authenticated;
GRANT SELECT ON public."CRM_Backup_Contactos_Eliminados_Asesores" TO authenticated;
CREATE POLICY "Lectura solo admin y coordinador" ON public."CRM_Backup_Contactos_Eliminados_Asesores" FOR SELECT TO authenticated USING (public.crm_puede_ver_eliminaciones());


CREATE OR REPLACE FUNCTION public.crm_backup_eliminacion_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nombre text; v_email text; v_rol text;
  v_origen text; v_padre uuid; v_cuenta uuid; v_id uuid := gen_random_uuid();
  v_tabla text;
BEGIN
  IF NOT (coalesce(OLD.is_deleted,false) = false AND NEW.is_deleted = true) THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF v_uid IS NOT NULL THEN
      SELECT full_name, email, role INTO v_nombre, v_email, v_rol FROM public."CRM_Usuarios" WHERE id = v_uid;
    END IF;
    v_origen := CASE WHEN v_uid IS NULL THEN 'SISTEMA' ELSE 'UI' END;

    IF TG_TABLE_NAME = 'CRM_Cuentas' THEN
      INSERT INTO public."CRM_Backup_Cuentas_Eliminadas_Asesores"
        (id, registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, resultado, origen_accion)
      VALUES (v_id, NEW.id, TG_TABLE_NAME, OLD.nombre, NEW.id, to_jsonb(OLD), v_uid, v_nombre, v_email, v_rol, 'EXITOSO', v_origen);
      PERFORM set_config('crm.eliminacion_padre_' || replace(NEW.id::text,'-',''), v_id::text, true);
      RETURN NULL;
    END IF;

    v_cuenta := NEW.account_id;
    IF v_cuenta IS NOT NULL THEN
      v_padre := nullif(current_setting('crm.eliminacion_padre_' || replace(v_cuenta::text,'-',''), true), '')::uuid;
      IF v_padre IS NULL THEN
        SELECT b.id INTO v_padre FROM public."CRM_Backup_Cuentas_Eliminadas_Asesores" b
         WHERE b.registro_id = v_cuenta AND b.resultado = 'EXITOSO' AND b.restaurado = false
           AND b.fecha_eliminacion > now() - interval '15 minutes'
         ORDER BY b.fecha_eliminacion DESC LIMIT 1;
      END IF;
      IF v_padre IS NOT NULL THEN v_origen := 'CASCADA_CUENTA'; END IF;
    END IF;

    IF TG_TABLE_NAME = 'CRM_Oportunidades' THEN
      INSERT INTO public."CRM_Backup_Oportunidades_Eliminadas_Asesores"
        (registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, resultado, origen_accion, eliminacion_padre_id)
      VALUES (NEW.id, TG_TABLE_NAME, OLD.nombre, v_cuenta, to_jsonb(OLD), v_uid, v_nombre, v_email, v_rol, 'EXITOSO', v_origen, v_padre);
    ELSE
      INSERT INTO public."CRM_Backup_Contactos_Eliminados_Asesores"
        (registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, resultado, origen_accion, eliminacion_padre_id)
      VALUES (NEW.id, TG_TABLE_NAME, OLD.nombre, v_cuenta, to_jsonb(OLD), v_uid, v_nombre, v_email, v_rol, 'EXITOSO', v_origen, v_padre);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crm_backup_eliminacion_trigger (%): %', TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_backup_eliminacion_trigger() FROM public, anon, authenticated;

CREATE TRIGGER trg_backup_eliminacion AFTER UPDATE OF is_deleted ON public."CRM_Cuentas"
  FOR EACH ROW WHEN (NEW.is_deleted IS TRUE AND OLD.is_deleted IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION public.crm_backup_eliminacion_trigger();
CREATE TRIGGER trg_backup_eliminacion AFTER UPDATE OF is_deleted ON public."CRM_Oportunidades"
  FOR EACH ROW WHEN (NEW.is_deleted IS TRUE AND OLD.is_deleted IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION public.crm_backup_eliminacion_trigger();
CREATE TRIGGER trg_backup_eliminacion AFTER UPDATE OF is_deleted ON public."CRM_Contactos"
  FOR EACH ROW WHEN (NEW.is_deleted IS TRUE AND OLD.is_deleted IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION public.crm_backup_eliminacion_trigger();

CREATE OR REPLACE FUNCTION public.crm_registrar_eliminacion_fallida(p_tabla text, p_registro_id uuid, p_motivo text, p_origen text DEFAULT 'UI')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid(); v_nombre text; v_email text; v_rol text;
  v_snap jsonb; v_nom text; v_cuenta uuid; v_id uuid := gen_random_uuid();
  v_origen text := CASE WHEN p_origen IN ('UI','SYNC_OFFLINE') THEN p_origen ELSE 'UI' END;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT full_name, email, role INTO v_nombre, v_email, v_rol FROM public."CRM_Usuarios" WHERE id = v_uid;
  IF p_tabla = 'CRM_Cuentas' THEN
    SELECT to_jsonb(c), c.nombre, c.id INTO v_snap, v_nom, v_cuenta FROM public."CRM_Cuentas" c WHERE c.id = p_registro_id;
    INSERT INTO public."CRM_Backup_Cuentas_Eliminadas_Asesores" (id, registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, resultado, motivo_fallo, origen_accion)
    VALUES (v_id, p_registro_id, p_tabla, v_nom, v_cuenta, coalesce(v_snap,'{}'::jsonb), v_uid, v_nombre, v_email, v_rol, 'FALLIDO', left(p_motivo, 2000), v_origen);
  ELSIF p_tabla = 'CRM_Oportunidades' THEN
    SELECT to_jsonb(o), o.nombre, o.account_id INTO v_snap, v_nom, v_cuenta FROM public."CRM_Oportunidades" o WHERE o.id = p_registro_id;
    INSERT INTO public."CRM_Backup_Oportunidades_Eliminadas_Asesores" (id, registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, resultado, motivo_fallo, origen_accion)
    VALUES (v_id, p_registro_id, p_tabla, v_nom, v_cuenta, coalesce(v_snap,'{}'::jsonb), v_uid, v_nombre, v_email, v_rol, 'FALLIDO', left(p_motivo, 2000), v_origen);
  ELSIF p_tabla = 'CRM_Contactos' THEN
    SELECT to_jsonb(ct), ct.nombre, ct.account_id INTO v_snap, v_nom, v_cuenta FROM public."CRM_Contactos" ct WHERE ct.id = p_registro_id;
    INSERT INTO public."CRM_Backup_Contactos_Eliminados_Asesores" (id, registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, resultado, motivo_fallo, origen_accion)
    VALUES (v_id, p_registro_id, p_tabla, v_nom, v_cuenta, coalesce(v_snap,'{}'::jsonb), v_uid, v_nombre, v_email, v_rol, 'FALLIDO', left(p_motivo, 2000), v_origen);
  ELSE
    RAISE EXCEPTION 'Tabla no permitida: %', p_tabla;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_registrar_eliminacion_fallida(text, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_registrar_eliminacion_fallida(text, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_restaurar_eliminado(p_backup_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid(); r record; v_hijos int := 0; n int;
BEGIN
  IF NOT public.crm_puede_ver_eliminaciones() THEN RAISE EXCEPTION 'Solo ADMIN o COORDINADOR pueden restaurar'; END IF;

  SELECT 'CRM_Cuentas' t, b.* INTO r FROM public."CRM_Backup_Cuentas_Eliminadas_Asesores" b WHERE b.id = p_backup_id;
  IF NOT FOUND THEN SELECT 'CRM_Oportunidades' t, b.* INTO r FROM public."CRM_Backup_Oportunidades_Eliminadas_Asesores" b WHERE b.id = p_backup_id; END IF;
  IF NOT FOUND THEN SELECT 'CRM_Contactos' t, b.* INTO r FROM public."CRM_Backup_Contactos_Eliminados_Asesores" b WHERE b.id = p_backup_id; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de backup no encontrado'; END IF;
  IF r.resultado <> 'EXITOSO' THEN RAISE EXCEPTION 'Solo se restauran eliminaciones exitosas'; END IF;
  IF r.restaurado THEN RAISE EXCEPTION 'Ya fue restaurado'; END IF;

  IF r.t = 'CRM_Cuentas' THEN
    UPDATE public."CRM_Cuentas" SET is_deleted = false, updated_at = now(), updated_by = v_uid WHERE id = r.registro_id;
    UPDATE public."CRM_Oportunidades" o SET is_deleted = false, updated_at = now(), updated_by = v_uid
      FROM public."CRM_Backup_Oportunidades_Eliminadas_Asesores" b
      WHERE b.eliminacion_padre_id = r.id AND b.restaurado = false AND o.id = b.registro_id;
    GET DIAGNOSTICS n = ROW_COUNT; v_hijos := v_hijos + n;
    UPDATE public."CRM_Contactos" c SET is_deleted = false, updated_at = now(), updated_by = v_uid
      FROM public."CRM_Backup_Contactos_Eliminados_Asesores" b
      WHERE b.eliminacion_padre_id = r.id AND b.restaurado = false AND c.id = b.registro_id;
    GET DIAGNOSTICS n = ROW_COUNT; v_hijos := v_hijos + n;
    UPDATE public."CRM_Backup_Oportunidades_Eliminadas_Asesores" SET restaurado = true, restaurado_por = v_uid, fecha_restauracion = now() WHERE eliminacion_padre_id = r.id AND restaurado = false;
    UPDATE public."CRM_Backup_Contactos_Eliminados_Asesores" SET restaurado = true, restaurado_por = v_uid, fecha_restauracion = now() WHERE eliminacion_padre_id = r.id AND restaurado = false;
    UPDATE public."CRM_Backup_Cuentas_Eliminadas_Asesores" SET restaurado = true, restaurado_por = v_uid, fecha_restauracion = now() WHERE id = r.id;
  ELSIF r.t = 'CRM_Oportunidades' THEN
    UPDATE public."CRM_Oportunidades" SET is_deleted = false, updated_at = now(), updated_by = v_uid WHERE id = r.registro_id;
    UPDATE public."CRM_Backup_Oportunidades_Eliminadas_Asesores" SET restaurado = true, restaurado_por = v_uid, fecha_restauracion = now() WHERE id = r.id;
  ELSE
    UPDATE public."CRM_Contactos" SET is_deleted = false, updated_at = now(), updated_by = v_uid WHERE id = r.registro_id;
    UPDATE public."CRM_Backup_Contactos_Eliminados_Asesores" SET restaurado = true, restaurado_por = v_uid, fecha_restauracion = now() WHERE id = r.id;
  END IF;
  RETURN jsonb_build_object('tabla', r.t, 'registro_id', r.registro_id, 'hijos_restaurados', v_hijos);
END;
$$;
REVOKE ALL ON FUNCTION public.crm_restaurar_eliminado(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_restaurar_eliminado(uuid) TO authenticated;

CREATE VIEW public."CRM_Vista_Eliminaciones_Asesores" WITH (security_invoker = true) AS
  SELECT id, 'CUENTA'::text AS tipo, registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, fecha_eliminacion, resultado, motivo_fallo, origen_accion, eliminacion_padre_id, restaurado, restaurado_por, fecha_restauracion FROM public."CRM_Backup_Cuentas_Eliminadas_Asesores"
  UNION ALL
  SELECT id, 'OPORTUNIDAD', registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, fecha_eliminacion, resultado, motivo_fallo, origen_accion, eliminacion_padre_id, restaurado, restaurado_por, fecha_restauracion FROM public."CRM_Backup_Oportunidades_Eliminadas_Asesores"
  UNION ALL
  SELECT id, 'CONTACTO', registro_id, tabla_origen, nombre_registro, cuenta_id, snapshot, eliminado_por, eliminado_por_nombre, eliminado_por_email, eliminado_por_rol, fecha_eliminacion, resultado, motivo_fallo, origen_accion, eliminacion_padre_id, restaurado, restaurado_por, fecha_restauracion FROM public."CRM_Backup_Contactos_Eliminados_Asesores";
REVOKE ALL ON public."CRM_Vista_Eliminaciones_Asesores" FROM anon;
GRANT SELECT ON public."CRM_Vista_Eliminaciones_Asesores" TO authenticated;
