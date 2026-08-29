-- Fix: Sales funnel phase grouping by canal and normalized name
-- Problem: All phases from all channels were shown simultaneously, grouping by 'orden'
-- which mixed non-equivalent phases (e.g. "Cerrada ganada" with "Negociación final" at orden 5)
-- Solution: When filtering by canal, show only that canal's phases.
--           When no canal filter, group by normalized phase name to deduplicate.

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
    SELECT id INTO v_absolute_initial_phase_id
    FROM "CRM_FasesOportunidad"
    WHERE is_active = true
    ORDER BY "CRM_FasesOportunidad".orden ASC
    LIMIT 1;

    IF p_canal_id IS NOT NULL THEN
        -- ===== FILTERED BY CANAL: Show only that canal's phases =====
        RETURN QUERY
        WITH ChannelPhases AS (
            SELECT 
                f.id as cp_id, 
                f.nombre::TEXT as cp_nombre,
                f.orden AS cp_orden, 
                f.canal_id as cp_canal_id,
                CASE f.orden
                    WHEN 1 THEN '#6366f1'::TEXT
                    WHEN 2 THEN '#8b5cf6'::TEXT
                    WHEN 3 THEN '#ec4899'::TEXT
                    WHEN 4 THEN '#f43f5e'::TEXT
                    WHEN 5 THEN '#f97316'::TEXT
                    WHEN 6 THEN '#10b981'::TEXT
                    WHEN 7 THEN '#64748b'::TEXT
                    ELSE '#94a3b8'::TEXT
                END as cp_color
            FROM "CRM_FasesOportunidad" f
            WHERE f.is_active = true
              AND f.canal_id = p_canal_id
        ),
        FilteredOpps AS (
            SELECT 
                o.id as fo_id,
                o.amount as fo_amount,
                o.fase_id as fo_fase_id
            FROM "CRM_Oportunidades" o
            JOIN "CRM_Cuentas" c ON o.account_id = c.id
            WHERE 
                o.is_deleted = false
                AND (o.estado_id = 1 OR o.estado_id IS NULL)
                AND (
                    p_user_role = 'ADMIN'
                    OR (p_user_role = 'COORDINADOR' AND true)
                    OR (p_user_role IN ('VENDEDOR', 'USER') AND (o.owner_user_id = p_user_id OR o.created_by = p_user_id))
                )
                AND (p_advisor_id IS NULL OR COALESCE(o.owner_user_id, o.created_by) = p_advisor_id)
                AND c.canal_id = p_canal_id
                AND (p_subclasificacion_id IS NULL OR c.subclasificacion_id = p_subclasificacion_id)
                AND (p_nivel_premium IS NULL OR c.nivel_premium = p_nivel_premium)
                AND (
                    p_search_query IS NULL 
                    OR o.nombre ILIKE '%' || p_search_query || '%'
                    OR c.nombre ILIKE '%' || p_search_query || '%'
                )
        )
        SELECT 
            cp.cp_id as fase_id,
            cp.cp_nombre as fase_nombre,
            cp.cp_orden as orden,
            COALESCE(SUM(fo.fo_amount), 0)::NUMERIC as total_amount,
            COUNT(fo.fo_amount)::BIGINT as count,
            cp.cp_color as color
        FROM ChannelPhases cp
        LEFT JOIN FilteredOpps fo ON cp.cp_id = fo.fo_fase_id
        GROUP BY cp.cp_id, cp.cp_nombre, cp.cp_orden, cp.cp_color
        ORDER BY cp.cp_orden;
    ELSE
        -- ===== NO CANAL FILTER: Group by normalized phase name =====
        RETURN QUERY
        WITH AllPhases AS (
            SELECT 
                f.id as ap_id, 
                f.nombre::TEXT as ap_nombre,
                LOWER(TRIM(f.nombre)) as ap_nombre_norm,
                f.orden AS ap_orden, 
                f.canal_id as ap_canal_id
            FROM "CRM_FasesOportunidad" f
            WHERE f.is_active = true
        ),
        UniquePhases AS (
            SELECT 
                ap_nombre_norm,
                MIN(ap_nombre) as up_nombre,
                MIN(ap_orden) as up_orden,
                array_agg(ap_id) as up_phase_ids
            FROM AllPhases
            GROUP BY ap_nombre_norm
        ),
        RankedPhases AS (
            SELECT 
                up.ap_nombre_norm,
                up.up_nombre,
                ROW_NUMBER() OVER (ORDER BY up.up_orden) as rp_display_orden,
                up.up_phase_ids
            FROM UniquePhases up
        ),
        ColoredPhases AS (
            SELECT
                rp.ap_nombre_norm,
                rp.up_nombre as cp_nombre,
                rp.rp_display_orden::INT as cp_orden,
                rp.up_phase_ids as cp_phase_ids,
                CASE rp.rp_display_orden
                    WHEN 1 THEN '#6366f1'::TEXT
                    WHEN 2 THEN '#8b5cf6'::TEXT
                    WHEN 3 THEN '#ec4899'::TEXT
                    WHEN 4 THEN '#f43f5e'::TEXT
                    WHEN 5 THEN '#f97316'::TEXT
                    WHEN 6 THEN '#10b981'::TEXT
                    WHEN 7 THEN '#64748b'::TEXT
                    ELSE '#94a3b8'::TEXT
                END as cp_color
            FROM RankedPhases rp
        ),
        InitialPhaseByChannel AS (
            SELECT DISTINCT ON (canal_id)
                canal_id as ipc_canal_id,
                id as ipc_phase_id
            FROM "CRM_FasesOportunidad"
            WHERE is_active = true AND canal_id IS NOT NULL
            ORDER BY canal_id, "CRM_FasesOportunidad".orden ASC
        ),
        FilteredOpps AS (
            SELECT 
                o.id as fo_id,
                o.amount as fo_amount,
                o.fase_id as fo_fase_id,
                c.canal_id as fo_canal_id
            FROM "CRM_Oportunidades" o
            JOIN "CRM_Cuentas" c ON o.account_id = c.id
            WHERE 
                o.is_deleted = false
                AND (o.estado_id = 1 OR o.estado_id IS NULL)
                AND (
                    p_user_role = 'ADMIN'
                    OR (p_user_role = 'COORDINADOR' AND true)
                    OR (p_user_role IN ('VENDEDOR', 'USER') AND (o.owner_user_id = p_user_id OR o.created_by = p_user_id))
                )
                AND (p_advisor_id IS NULL OR COALESCE(o.owner_user_id, o.created_by) = p_advisor_id)
                AND (p_subclasificacion_id IS NULL OR c.subclasificacion_id = p_subclasificacion_id)
                AND (p_nivel_premium IS NULL OR c.nivel_premium = p_nivel_premium)
                AND (
                    p_search_query IS NULL 
                    OR o.nombre ILIKE '%' || p_search_query || '%'
                    OR c.nombre ILIKE '%' || p_search_query || '%'
                )
        ),
        ResolvedOpps AS (
            SELECT 
                fo.fo_amount,
                COALESCE(
                    fo.fo_fase_id, 
                    ipc.ipc_phase_id, 
                    v_absolute_initial_phase_id
                ) as ro_fase_id
            FROM FilteredOpps fo
            LEFT JOIN InitialPhaseByChannel ipc ON fo.fo_canal_id = ipc.ipc_canal_id
        )
        SELECT 
            (cp.cp_phase_ids[1])::INT as fase_id,
            cp.cp_nombre as fase_nombre,
            cp.cp_orden as orden,
            COALESCE(SUM(ro.fo_amount), 0)::NUMERIC as total_amount,
            COUNT(ro.fo_amount)::BIGINT as count,
            cp.cp_color as color
        FROM ColoredPhases cp
        LEFT JOIN ResolvedOpps ro ON ro.ro_fase_id = ANY(cp.cp_phase_ids)
        GROUP BY cp.cp_phase_ids, cp.cp_nombre, cp.cp_orden, cp.cp_color
        ORDER BY cp.cp_orden;
    END IF;
END;
$$;
