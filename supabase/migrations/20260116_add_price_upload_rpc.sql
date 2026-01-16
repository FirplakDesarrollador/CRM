-- Migration to add admin_upsert_price_list RPC
-- Allows batch upsert of price list items from JSONB
-- Usage: supabase.rpc('admin_upsert_price_list', { prices: [...] })

CREATE OR REPLACE FUNCTION admin_upsert_price_list(prices jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO "CRM_ListaDePrecios" (
    numero_articulo,
    descripcion,
    lista_base_cop,
    lista_base_exportaciones,
    lista_base_obras,
    distribuidor_pvp_iva,
    pvp_sin_iva,
    descuentos_volumen
  )
  SELECT
    x.numero_articulo,
    x.descripcion,
    COALESCE(x.lista_base_cop, 0),
    COALESCE(x.lista_base_exportaciones, 0),
    COALESCE(x.lista_base_obras, 0),
    COALESCE(x.distribuidor_pvp_iva, 0),
    COALESCE(x.pvp_sin_iva, 0),
    COALESCE(x.descuentos_volumen, '{}'::jsonb)
  FROM jsonb_to_recordset(prices) AS x(
    numero_articulo text,
    descripcion text,
    lista_base_cop numeric,
    lista_base_exportaciones numeric,
    lista_base_obras numeric,
    distribuidor_pvp_iva numeric,
    pvp_sin_iva numeric,
    descuentos_volumen jsonb
  )
  ON CONFLICT (numero_articulo) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    lista_base_cop = EXCLUDED.lista_base_cop,
    lista_base_exportaciones = EXCLUDED.lista_base_exportaciones,
    lista_base_obras = EXCLUDED.lista_base_obras,
    distribuidor_pvp_iva = EXCLUDED.distribuidor_pvp_iva,
    pvp_sin_iva = EXCLUDED.pvp_sin_iva,
    descuentos_volumen = EXCLUDED.descuentos_volumen;
$$;
