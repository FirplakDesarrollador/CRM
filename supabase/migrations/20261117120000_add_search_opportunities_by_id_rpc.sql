-- RPC to search opportunities by ID (partial or full UUID)
CREATE OR REPLACE FUNCTION public.search_opportunities_by_id(search_term text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public."CRM_Oportunidades"
  WHERE id::text ILIKE '%' || search_term || '%'
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.search_opportunities_by_id(text) TO anon, authenticated, service_role;
