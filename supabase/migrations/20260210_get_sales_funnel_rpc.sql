-- Create RPC to get sales funnel data based on user role
CREATE OR REPLACE FUNCTION get_sales_funnel(
  p_user_id uuid,
  p_role text
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
      -- Case 1: Admin sees ALL (so we match all users)
      (p_role = 'ADMIN')
      OR
      -- Case 2: Coordinator sees themselves AND any user who has them listed as a coordinator
      (p_role = 'COORDINADOR' AND (id = p_user_id OR p_user_id = ANY(coordinadores)))
      OR
      -- Case 3: Salesperson sees ONLY themselves
      (p_role = 'VENDEDOR' AND id = p_user_id)
  ),
  AggregatedData AS (
    SELECT 
      o.fase_id,
      SUM(COALESCE(o.amount, 0)) as total_val, -- Use 'amount' alias for amount if that's what is in DB, schema said 'valor' or 'amount'
      COUNT(o.id) as opp_count
    FROM "CRM_Oportunidades" o
    WHERE 
      o.is_deleted = false 
      AND (o.estado_id = 1 OR o.estado_id IS NULL) -- Only OPEN opportunities
      AND o.owner_user_id IN (SELECT id FROM UserScope)
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
  ORDER BY f.orden ASC;

END;
$$;
