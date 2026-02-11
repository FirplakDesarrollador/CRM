-- =============================================================================
-- COMMISSION ENGINE: Support for Multiple Accounts per Rule
-- Date: 2026-02-10
-- =============================================================================

-- 1. Add cuentas_ids column
ALTER TABLE "CRM_ComisionReglas" ADD COLUMN IF NOT EXISTS cuentas_ids UUID[];

-- 2. Index for array performance
CREATE INDEX IF NOT EXISTS idx_comision_reglas_cuentas_ids ON "CRM_ComisionReglas" USING GIN (cuentas_ids);

-- 3. Update resolve_commission_rule to include array check
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
            CASE 
                WHEN (r.cuenta_id IS NOT NULL AND r.cuenta_id = p_cuenta_id) 
                     OR (r.cuentas_ids IS NOT NULL AND ARRAY[p_cuenta_id] && r.cuentas_ids) -- Array overlap check
                THEN 4 ELSE 0 
            END +
            CASE WHEN r.categoria_id IS NOT NULL AND r.categoria_id = p_categoria_id THEN 2 ELSE 0 END +
            CASE WHEN r.canal_id IS NOT NULL AND r.canal_id = p_canal_id THEN 1 ELSE 0 END
        ) AS priority_score,
        jsonb_build_object(
            'rule_id', r.id,
            'nombre', r.nombre,
            'vendedor_id', r.vendedor_id,
            'cuenta_id', r.cuenta_id,
            'cuentas_ids', r.cuentas_ids,
            'categoria_id', r.categoria_id,
            'canal_id', r.canal_id,
            'porcentaje_comision', r.porcentaje_comision,
            'vigencia_desde', r.vigencia_desde,
            'vigencia_hasta', r.vigencia_hasta
        ) AS rule_snapshot
    FROM "CRM_ComisionReglas" r
    WHERE r.is_active = TRUE
      AND (r.vendedor_id IS NULL OR r.vendedor_id = p_vendedor_id)
      AND (
          (r.cuenta_id IS NULL AND (r.cuentas_ids IS NULL OR r.cuentas_ids = '{}')) -- Wildcard match
          OR (r.cuenta_id = p_cuenta_id)
          OR (r.cuentas_ids IS NOT NULL AND ARRAY[p_cuenta_id] && r.cuentas_ids)
      )
      AND (r.categoria_id IS NULL OR r.categoria_id = p_categoria_id)
      AND (r.canal_id IS NULL OR r.canal_id = p_canal_id)
      AND r.vigencia_desde <= p_fecha
      AND (r.vigencia_hasta IS NULL OR r.vigencia_hasta >= p_fecha)
    ORDER BY 
        r.porcentaje_comision ASC, 
        priority_score DESC, 
        r.created_at DESC
    LIMIT 1;
END;
$$;
