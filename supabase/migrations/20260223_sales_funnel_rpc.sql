-- Function to aggregate sales funnel data
CREATE OR REPLACE FUNCTION get_sales_funnel_data(
    p_user_id UUID,
    p_user_role TEXT,
    p_canal_id TEXT DEFAULT NULL,
    p_advisor_id UUID DEFAULT NULL,
    p_subclasificacion_id INT DEFAULT NULL,
    p_nivel_premium TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    fase_id INT,
    fase_nombre TEXT,
    orden INT,
    total_amount NUMERIC,
    count BIGINT,
    color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_absolute_initial_phase_id INT;
BEGIN
    -- 1. Find the absolute initial phase (lowest orden)
    SELECT id INTO v_absolute_initial_phase_id
    FROM "CRM_FasesOportunidad"
    WHERE is_active = true
    ORDER BY orden ASC
    LIMIT 1;

    -- 2. Return the aggregated data
    RETURN QUERY
    WITH ActivePhases AS (
        SELECT 
            id, 
            nombre, 
            orden, 
            canal_id,
            CASE orden
                WHEN 1 THEN '#6366f1'
                WHEN 2 THEN '#8b5cf6'
                WHEN 3 THEN '#ec4899'
                WHEN 4 THEN '#f43f5e'
                WHEN 5 THEN '#f97316'
                WHEN 6 THEN '#10b981'
                ELSE '#64748b'
            END as color
        FROM "CRM_FasesOportunidad"
        WHERE is_active = true
    ),
    InitialPhaseByChannel AS (
        -- Get the phase with the lowest orden for each channel
        SELECT DISTINCT ON (canal_id)
            canal_id,
            id as initial_phase_id
        FROM "CRM_FasesOportunidad"
        WHERE is_active = true AND canal_id IS NOT NULL
        ORDER BY canal_id, orden ASC
    ),
    FilteredOpportunities AS (
        SELECT 
            o.id,
            o.amount,
            o.fase_id,
            c.canal_id as cuenta_canal_id
        FROM "CRM_Oportunidades" o
        JOIN "CRM_Cuentas" c ON o.account_id = c.id
        WHERE 
            o.is_deleted = false
            AND (o.estado_id = 1 OR o.estado_id IS NULL)
            -- Role-based filtering
            AND (
                p_user_role = 'ADMIN'
                OR (p_user_role = 'COORDINADOR' AND (o.owner_user_id = p_user_id OR o.created_by = p_user_id OR true)) -- Keeping 'true' for coordinator as per original comment "assume all synced opps for coordinator are visible"
                OR (p_user_role IN ('VENDEDOR', 'USER') AND (o.owner_user_id = p_user_id OR o.created_by = p_user_id))
            )
            -- Explicit Filters
            AND (p_advisor_id IS NULL OR COALESCE(o.owner_user_id, o.created_by) = p_advisor_id)
            AND (p_canal_id IS NULL OR c.canal_id = p_canal_id)
            AND (p_subclasificacion_id IS NULL OR c.subclasificacion_id = p_subclasificacion_id)
            AND (p_nivel_premium IS NULL OR c.nivel_premium = p_nivel_premium)
            AND (
                p_search_query IS NULL 
                OR o.nombre ILIKE '%' || p_search_query || '%'
                OR c.nombre ILIKE '%' || p_search_query || '%'
            )
    ),
    OpportunitiesWithResolvedPhase AS (
        SELECT 
            fo.amount,
            COALESCE(
                fo.fase_id, 
                ipc.initial_phase_id, 
                v_absolute_initial_phase_id
            ) as resolved_fase_id
        FROM FilteredOpportunities fo
        LEFT JOIN InitialPhaseByChannel ipc ON fo.cuenta_canal_id = ipc.canal_id
    )
    SELECT 
        ap.id as fase_id,
        ap.nombre as fase_nombre,
        ap.orden,
        COALESCE(SUM(owrp.amount), 0)::NUMERIC as total_amount,
        COUNT(owrp.amount)::BIGINT as count,
        ap.color
    FROM ActivePhases ap
    LEFT JOIN OpportunitiesWithResolvedPhase owrp ON ap.id = owrp.resolved_fase_id
    GROUP BY ap.id, ap.nombre, ap.orden, ap.color
    ORDER BY ap.orden;
END;
$$;
