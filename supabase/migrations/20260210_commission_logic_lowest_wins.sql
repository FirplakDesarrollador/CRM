-- =============================================================================
-- COMMISSION ENGINE: Change Priority Logic
-- Requirement: The LOWEST commission % always wins, regardless of rule specificity.
-- Date: 2026-02-10
-- =============================================================================

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
        -- We keep priority_score calculation for reference/snapshot
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
      -- Match dimensions (either specific match OR wildcard/null)
      AND (r.vendedor_id IS NULL OR r.vendedor_id = p_vendedor_id)
      AND (r.cuenta_id IS NULL OR r.cuenta_id = p_cuenta_id)
      AND (r.categoria_id IS NULL OR r.categoria_id = p_categoria_id)
      AND (r.canal_id IS NULL OR r.canal_id = p_canal_id)
      -- Check valid date range
      AND r.vigencia_desde <= p_fecha
      AND (r.vigencia_hasta IS NULL OR r.vigencia_hasta >= p_fecha)
    
    -- ORDER BY: Lowest Percentage First
    -- Secondary sort by priority (most specific first) in case of tie.
    ORDER BY 
        r.porcentaje_comision ASC, 
        priority_score DESC, 
        r.created_at DESC
    LIMIT 1;
END;
$$;
