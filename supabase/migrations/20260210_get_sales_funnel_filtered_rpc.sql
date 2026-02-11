-- Create RPC to get sales funnel data based on user role and optional filters
CREATE OR REPLACE FUNCTION get_sales_funnel(
  p_user_id uuid,
  p_role text,
  p_canal_id text DEFAULT NULL,
  p_advisor_id uuid DEFAULT NULL,
  p_subclasificacion_id int DEFAULT NULL
)
RETURNS TABLE (
  fase_id int,
  fase_nombre text,
  orden int,
  total_amount numeric,
  count bigint,
  color text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate Role
  -- Admin: See ALL
  -- Coordinator: See OWN + SUBORDINATES (users where they are in 'coordinadores' array)
  -- Salesperson (VENDEDOR): See OWN ONLY

  RETURN QUERY
  WITH UserScope AS (
    SELECT id 
    FROM "CRM_Usuarios"
    WHERE 
      (
        -- Standard Role Filtering
        ((p_role = 'ADMIN'))
        OR
        (p_role = 'COORDINADOR' AND (id = p_user_id OR p_user_id = ANY(coordinadores)))
        OR
        (p_role = 'VENDEDOR' AND id = p_user_id)
      )
      AND 
      (
        -- Optional Advisor Filter (Applied AFTER role filtering for safety)
        p_advisor_id IS NULL OR id = p_advisor_id
      )
  ),
  AggregatedData AS (
    SELECT 
      o.fase_id,
      SUM(COALESCE(o.amount, 0)) as total_val,
      COUNT(o.id) as opp_count
    FROM "CRM_Oportunidades" o
    JOIN "CRM_Cuentas" acc ON o.account_id = acc.id
    WHERE 
      o.is_deleted = false 
      AND (o.estado_id = 1 OR o.estado_id IS NULL) -- Only OPEN opportunities
      AND o.owner_user_id IN (SELECT id FROM UserScope)
      AND (p_canal_id IS NULL OR acc.canal_id = p_canal_id)
      AND (p_subclasificacion_id IS NULL OR acc.subclasificacion_id = p_subclasificacion_id)
    GROUP BY o.fase_id
  )
  SELECT 
    f.id::int as fase_id,
    f.nombre::text as fase_nombre,
    f.orden::int,
    COALESCE(ad.total_val, 0)::numeric as total_amount,
    COALESCE(ad.opp_count, 0)::bigint as count,
    CASE 
      WHEN f.orden = 1 THEN '#6366f1' -- Indigo
      WHEN f.orden = 2 THEN '#8b5cf6' -- Violet
      WHEN f.orden = 3 THEN '#ec4899' -- Pink
      WHEN f.orden = 4 THEN '#f43f5e' -- Rose
      WHEN f.orden = 5 THEN '#f97316' -- Orange
      ELSE '#64748b' -- Slate
    END::text as color
  FROM "CRM_FasesOportunidad" f
  LEFT JOIN AggregatedData ad ON f.id = ad.fase_id
  WHERE f.is_active = true
    AND (p_canal_id IS NULL OR f.canal_id = p_canal_id) -- Only show phases relevant to the selected channel if filtered
  ORDER BY f.orden ASC;

END;
$$;
