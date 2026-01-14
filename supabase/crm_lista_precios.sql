-- CRM_ListaDePrecios: Product Price List from BD precios CRM.xlsx
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "CRM_ListaDePrecios" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_articulo text NOT NULL UNIQUE,
    descripcion text NOT NULL,
    lista_base_cop numeric(18, 2),
    distribuidor_descuento numeric(5, 4),
    distribuidor_pvp_iva numeric(18, 2),
    zona2_pvp numeric(18, 2),
    mayorista_cop numeric(18, 2),
    pvp_sin_iva numeric(18, 2),
    lista_base_exportaciones numeric(18, 2),
    lista_base_obras numeric(18, 2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE "CRM_ListaDePrecios" 
    ALTER COLUMN distribuidor_descuento TYPE numeric(10, 4);

-- Public read policy (prices are generally public for sales team)
CREATE POLICY "Allow read access to all users" ON "CRM_ListaDePrecios"
    FOR SELECT USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_lista_precios_articulo ON "CRM_ListaDePrecios" (numero_articulo);
CREATE INDEX IF NOT EXISTS idx_lista_precios_descripcion ON "CRM_ListaDePrecios" USING gin (to_tsvector('spanish', descripcion));
