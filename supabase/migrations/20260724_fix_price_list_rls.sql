-- Migracion para corregir RLS en CRM_ListaDePrecios y permitir la carga masiva a administradores
BEGIN;

ALTER TABLE "CRM_ListaDePrecios" ENABLE ROW LEVEL SECURITY;

-- 1. Lectura pública para usuarios autenticados
DROP POLICY IF EXISTS "ListaDePrecios visible para autenticados" ON "CRM_ListaDePrecios";
CREATE POLICY "ListaDePrecios visible para autenticados"
ON "CRM_ListaDePrecios" FOR SELECT TO authenticated
USING (TRUE);

-- 2. Permisos de inserción, actualización y borrado para administradores
DROP POLICY IF EXISTS "ListaDePrecios gestionable por admin" ON "CRM_ListaDePrecios";
CREATE POLICY "ListaDePrecios gestionable por admin"
ON "CRM_ListaDePrecios" FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE))
WITH CHECK (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE));

-- 3. Función RPC SECURITY DEFINER para upsert masivo
CREATE OR REPLACE FUNCTION admin_upsert_price_list(prices JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "CRM_Usuarios"
        WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo los administradores pueden actualizar la lista de precios';
    END IF;

    INSERT INTO "CRM_ListaDePrecios" (
        numero_articulo, descripcion, lista_base_cop, lista_base_exportaciones,
        lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva, precio_feria,
        descuentos_volumen, planta, familia
    )
    SELECT
        x.numero_articulo,
        x.descripcion,
        COALESCE(x.lista_base_cop, 0),
        COALESCE(x.lista_base_exportaciones, 0),
        COALESCE(x.lista_base_obras, 0),
        COALESCE(x.distribuidor_pvp_iva, 0),
        COALESCE(x.pvp_sin_iva, 0),
        COALESCE(x.precio_feria, 0),
        COALESCE(x.descuentos_volumen, '{}'::JSONB),
        x.planta,
        x.familia
    FROM JSONB_TO_RECORDSET(prices) AS x(
        numero_articulo TEXT,
        descripcion TEXT,
        lista_base_cop NUMERIC,
        lista_base_exportaciones NUMERIC,
        lista_base_obras NUMERIC,
        distribuidor_pvp_iva NUMERIC,
        pvp_sin_iva NUMERIC,
        precio_feria NUMERIC,
        descuentos_volumen JSONB,
        planta TEXT,
        familia TEXT
    )
    ON CONFLICT (numero_articulo) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        lista_base_cop = EXCLUDED.lista_base_cop,
        lista_base_exportaciones = EXCLUDED.lista_base_exportaciones,
        lista_base_obras = EXCLUDED.lista_base_obras,
        distribuidor_pvp_iva = EXCLUDED.distribuidor_pvp_iva,
        pvp_sin_iva = EXCLUDED.pvp_sin_iva,
        precio_feria = EXCLUDED.precio_feria,
        descuentos_volumen = EXCLUDED.descuentos_volumen,
        planta = EXCLUDED.planta,
        familia = EXCLUDED.familia;
END;
$$;

REVOKE ALL ON FUNCTION admin_upsert_price_list(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_upsert_price_list(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
