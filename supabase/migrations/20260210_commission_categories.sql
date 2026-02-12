-- =============================================================================
-- COMMISSION ENGINE: Product Categories + Helper Functions
-- Maps the first 6 characters of numero_articulo to SAP product categories
-- Date: 2026-02-10
-- =============================================================================

-- 0. Helper functions for role-based checks (SECURITY DEFINER = deferred table resolution)
CREATE OR REPLACE FUNCTION is_crm_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM "CRM_Usuarios"
        WHERE id = auth.uid() AND role = 'ADMIN'
    );
END;
$$;

CREATE OR REPLACE FUNCTION is_crm_admin_or_coord()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM "CRM_Usuarios"
        WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINADOR')
    );
END;
$$;

-- 1. Category Master Table
CREATE TABLE IF NOT EXISTS "CRM_ComisionCategorias" (
    id SERIAL PRIMARY KEY,
    prefijo VARCHAR(6) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comision_cat_prefijo ON "CRM_ComisionCategorias" (prefijo);
CREATE INDEX IF NOT EXISTS idx_comision_cat_active ON "CRM_ComisionCategorias" (is_active);

-- 2. Function to extract category prefix from numero_articulo
CREATE OR REPLACE FUNCTION get_category_prefix(p_numero_articulo TEXT)
RETURNS VARCHAR(6)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT LEFT(p_numero_articulo, 6);
$$;

-- 3. Function to resolve category_id from a product ID
CREATE OR REPLACE FUNCTION get_product_category_id(p_producto_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_numero_articulo TEXT;
    v_categoria_id INT;
BEGIN
    SELECT numero_articulo INTO v_numero_articulo
    FROM "CRM_ListaDePrecios"
    WHERE id = p_producto_id;

    IF v_numero_articulo IS NULL THEN RETURN NULL; END IF;

    SELECT id INTO v_categoria_id
    FROM "CRM_ComisionCategorias"
    WHERE prefijo = LEFT(v_numero_articulo, 6) AND is_active = TRUE;

    RETURN v_categoria_id;
END;
$$;

-- 4. RLS (permissive read, admin-only write via helper function)
ALTER TABLE "CRM_ComisionCategorias" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read categories"
    ON "CRM_ComisionCategorias" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin write categories"
    ON "CRM_ComisionCategorias" FOR INSERT TO authenticated
    WITH CHECK (is_crm_admin());

CREATE POLICY "Admin update categories"
    ON "CRM_ComisionCategorias" FOR UPDATE TO authenticated
    USING (is_crm_admin())
    WITH CHECK (is_crm_admin());

CREATE POLICY "Admin delete categories"
    ON "CRM_ComisionCategorias" FOR DELETE TO authenticated
    USING (is_crm_admin());

-- 5. Grants
GRANT ALL ON "CRM_ComisionCategorias" TO authenticated;
GRANT ALL ON "CRM_ComisionCategorias" TO service_role;
GRANT USAGE, SELECT ON SEQUENCE "CRM_ComisionCategorias_id_seq" TO authenticated;
