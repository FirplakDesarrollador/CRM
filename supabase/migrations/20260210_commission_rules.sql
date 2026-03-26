-- =============================================================================
-- COMMISSION ENGINE: Rules & Priority Resolution
-- Priority scoring: vendedor +8, cuenta +4, categoria +2, canal +1
-- NULL in a dimension = wildcard (applies to all)
-- Date: 2026-02-10
-- Depends on: 20260210_commission_categories.sql
-- =============================================================================

-- 1. Commission Rules Table
CREATE TABLE IF NOT EXISTS "CRM_ComisionReglas" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(200),
    vendedor_id UUID,
    cuenta_id UUID REFERENCES "CRM_Cuentas"(id),
    categoria_id INT REFERENCES "CRM_ComisionCategorias"(id),
    canal_id VARCHAR(20) REFERENCES "CRM_Canales"(id),
    porcentaje_comision NUMERIC(5,2) NOT NULL CHECK (porcentaje_comision >= 0 AND porcentaje_comision <= 100),
    vigencia_desde DATE DEFAULT CURRENT_DATE,
    vigencia_hasta DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rule resolution
CREATE INDEX IF NOT EXISTS idx_comision_reglas_vendedor ON "CRM_ComisionReglas" (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_comision_reglas_cuenta ON "CRM_ComisionReglas" (cuenta_id);
CREATE INDEX IF NOT EXISTS idx_comision_reglas_categoria ON "CRM_ComisionReglas" (categoria_id);
CREATE INDEX IF NOT EXISTS idx_comision_reglas_canal ON "CRM_ComisionReglas" (canal_id);
CREATE INDEX IF NOT EXISTS idx_comision_reglas_active ON "CRM_ComisionReglas" (is_active, vigencia_desde, vigencia_hasta);

-- 2. Rule Resolution Function
-- Returns the single best-matching rule for the given dimensions
CREATE OR REPLACE FUNCTION resolve_commission_rule(
    p_vendedor_id UUID,
    p_cuenta_id UUID,
    p_categoria_id INT,
    p_canal_id VARCHAR(20),
    p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    rule_id UUID,
    porcentaje_comision NUMERIC(5,2),
    priority_score INT,
    rule_snapshot JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id AS rule_id,
        r.porcentaje_comision,
        (
            CASE WHEN r.vendedor_id IS NOT NULL AND r.vendedor_id = p_vendedor_id THEN 8 ELSE 0 END +
            CASE WHEN r.cuenta_id IS NOT NULL AND r.cuenta_id = p_cuenta_id THEN 4 ELSE 0 END +
            CASE WHEN r.categoria_id IS NOT NULL AND r.categoria_id = p_categoria_id THEN 2 ELSE 0 END +
            CASE WHEN r.canal_id IS NOT NULL AND r.canal_id = p_canal_id THEN 1 ELSE 0 END
        ) AS priority_score,
        jsonb_build_object(
            'rule_id', r.id,
            'nombre', r.nombre,
            'vendedor_id', r.vendedor_id,
            'cuenta_id', r.cuenta_id,
            'categoria_id', r.categoria_id,
            'canal_id', r.canal_id,
            'porcentaje_comision', r.porcentaje_comision,
            'vigencia_desde', r.vigencia_desde,
            'vigencia_hasta', r.vigencia_hasta
        ) AS rule_snapshot
    FROM "CRM_ComisionReglas" r
    WHERE r.is_active = TRUE
      AND (r.vendedor_id IS NULL OR r.vendedor_id = p_vendedor_id)
      AND (r.cuenta_id IS NULL OR r.cuenta_id = p_cuenta_id)
      AND (r.categoria_id IS NULL OR r.categoria_id = p_categoria_id)
      AND (r.canal_id IS NULL OR r.canal_id = p_canal_id)
      AND r.vigencia_desde <= p_fecha
      AND (r.vigencia_hasta IS NULL OR r.vigencia_hasta >= p_fecha)
    ORDER BY priority_score DESC, r.created_at DESC
    LIMIT 1;
END;
$$;

-- 3. RLS Policies (using helper functions from categories migration)
ALTER TABLE "CRM_ComisionReglas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rules"
    ON "CRM_ComisionReglas" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Coord insert rules"
    ON "CRM_ComisionReglas" FOR INSERT TO authenticated
    WITH CHECK (is_crm_admin_or_coord());

CREATE POLICY "Admin/Coord update rules"
    ON "CRM_ComisionReglas" FOR UPDATE TO authenticated
    USING (is_crm_admin_or_coord())
    WITH CHECK (is_crm_admin_or_coord());

-- 4. Grants
GRANT ALL ON "CRM_ComisionReglas" TO authenticated;
GRANT ALL ON "CRM_ComisionReglas" TO service_role;
