-- Usuarios de tienda: ven todas las cuentas y, en oportunidades y actividades, solo las suyas.
-- No cambia el rol. es_tienda = false (el valor por defecto) deja a admins, coordinadores
-- y vendedores exactamente como estaban.
--
-- Las políticas nuevas son RESTRICTIVE: se suman con AND a las políticas permisivas
-- que ya existen (incluida "Permissive All"). Para quien no es tienda la condición
-- es verdadera y no recorta filas.
--
-- El marcado de los cuatro usuarios NO se ejecuta aquí. Va comentado al final para
-- poder verificar el SELECT de nombres y correos antes de actualizar.

ALTER TABLE public."CRM_Usuarios"
    ADD COLUMN IF NOT EXISTS es_tienda boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public."CRM_Usuarios".es_tienda IS
    'Usuario de tienda. Ve todas las cuentas. En oportunidades solo owner_user_id = él. En actividades solo user_id = él. No sustituye al rol.';

CREATE INDEX IF NOT EXISTS idx_actividades_user_id
    ON public."CRM_Actividades" (user_id);

-- SECURITY DEFINER para leer la bandera aunque RLS de CRM_Usuarios cambie.
-- Solo responde por el usuario de la sesión: un id ajeno devuelve false.
CREATE OR REPLACE FUNCTION public.crm_usuario_es_tienda(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_user_id IS NULL OR p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN false
        ELSE COALESCE(
            (SELECT u.es_tienda FROM public."CRM_Usuarios" u WHERE u.id = p_user_id),
            false
        )
    END;
$$;

REVOKE ALL ON FUNCTION public.crm_usuario_es_tienda(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_usuario_es_tienda(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_usuario_es_tienda(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tienda solo lee oportunidades propias" ON public."CRM_Oportunidades";
CREATE POLICY "Tienda solo lee oportunidades propias"
ON public."CRM_Oportunidades"
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
    NOT (SELECT public.crm_usuario_es_tienda((SELECT auth.uid())))
    OR owner_user_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "Tienda solo lee actividades propias" ON public."CRM_Actividades";
CREATE POLICY "Tienda solo lee actividades propias"
ON public."CRM_Actividades"
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
    NOT (SELECT public.crm_usuario_es_tienda((SELECT auth.uid())))
    OR user_id = (SELECT auth.uid())
);

NOTIFY pgrst, 'reload schema';

/*
MARCADO MANUAL. No se ejecuta con esta migración: va dentro de un comentario
para poder leer el SELECT antes de tocar filas. Si una búsqueda no devuelve
exactamente una persona, el bloque aborta y no marca a nadie.

-- 1) Verificar
SELECT id, email, full_name, role, es_tienda
FROM public."CRM_Usuarios"
WHERE id = '76c2d61b-7023-42d8-bea9-b1905d1f5159'
   OR lower(email) = 'administradorbogota@firplak.com'
   OR full_name ILIKE '%medardo%hoyos%'
   OR full_name ILIKE '%natalia%gomez%usme%'
   OR full_name ILIKE '%natalia%gómez%usme%'
   OR full_name ILIKE '%hernando%tovar%';

-- 2) Marcar (solo después de revisar el SELECT)
BEGIN;
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public."CRM_Usuarios"
  WHERE id = '76c2d61b-7023-42d8-bea9-b1905d1f5159'
    AND lower(email) = 'administradorbogota@firplak.com';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Víctor Julio Hernández González: se esperaba 1 fila (id+email) y hay %', n;
  END IF;
  UPDATE public."CRM_Usuarios" SET es_tienda = true
  WHERE id = '76c2d61b-7023-42d8-bea9-b1905d1f5159'
    AND lower(email) = 'administradorbogota@firplak.com';

  SELECT count(*) INTO n FROM public."CRM_Usuarios" WHERE full_name ILIKE '%medardo%hoyos%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Medardo Hoyos: se esperaba 1 fila y hay %', n;
  END IF;
  UPDATE public."CRM_Usuarios" SET es_tienda = true WHERE full_name ILIKE '%medardo%hoyos%';

  SELECT count(*) INTO n FROM public."CRM_Usuarios"
  WHERE full_name ILIKE '%natalia%gomez%usme%' OR full_name ILIKE '%natalia%gómez%usme%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Natalia Gómez Usme: se esperaba 1 fila y hay %', n;
  END IF;
  UPDATE public."CRM_Usuarios" SET es_tienda = true
  WHERE full_name ILIKE '%natalia%gomez%usme%' OR full_name ILIKE '%natalia%gómez%usme%';

  SELECT count(*) INTO n FROM public."CRM_Usuarios" WHERE full_name ILIKE '%hernando%tovar%';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Hernando Tovar Mendoza: se esperaba 1 fila y hay %', n;
  END IF;
  UPDATE public."CRM_Usuarios" SET es_tienda = true WHERE full_name ILIKE '%hernando%tovar%';
END $$;
COMMIT;
*/

-- ROLLBACK de esquema (después de poner es_tienda = false si ya se marcó gente):
-- BEGIN;
-- UPDATE public."CRM_Usuarios" SET es_tienda = false WHERE es_tienda = true;
-- DROP POLICY IF EXISTS "Tienda solo lee oportunidades propias" ON public."CRM_Oportunidades";
-- DROP POLICY IF EXISTS "Tienda solo lee actividades propias" ON public."CRM_Actividades";
-- DROP FUNCTION IF EXISTS public.crm_usuario_es_tienda(uuid);
-- DROP INDEX IF EXISTS public.idx_actividades_user_id;
-- ALTER TABLE public."CRM_Usuarios" DROP COLUMN IF EXISTS es_tienda;
-- COMMIT;
