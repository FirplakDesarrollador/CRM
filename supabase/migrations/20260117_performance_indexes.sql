-- =============================================================================
-- PERFORMANCE UPGRADE: Indexes & Global Search
-- Date: 2026-01-17
-- =============================================================================

-- 1. Optimizing CRM_Oportunidades
-- Support fast filtering by status, owner, account, and sorting by date
CREATE INDEX IF NOT EXISTS idx_oportunidades_owner ON "CRM_Oportunidades" (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_account ON "CRM_Oportunidades" (account_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_fase ON "CRM_Oportunidades" (fase_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_updated_at ON "CRM_Oportunidades" (updated_at DESC);
-- Text search index (using gin for ilike matching if using pg_trgm, but default btree works for prefix like)
-- For 'ilike %term%' standard btree isn't enough usually, but for starters we use standard indexes for equality/sorting
-- If pg_trgm is available: CREATE INDEX idx_oportunidades_nombre_trgm ON "CRM_Oportunidades" USING gin (nombre gin_trgm_ops);

-- 2. Optimizing CRM_Contactos
CREATE INDEX IF NOT EXISTS idx_contactos_account ON "CRM_Contactos" (account_id);
CREATE INDEX IF NOT EXISTS idx_contactos_email ON "CRM_Contactos" (email);

-- 3. Optimizing CRM_Cuentas
CREATE INDEX IF NOT EXISTS idx_cuentas_nombre ON "CRM_Cuentas" (nombre);
CREATE INDEX IF NOT EXISTS idx_cuentas_nit ON "CRM_Cuentas" (nit);

-- 4. Unified Global Search RPC
-- Searches across Opportunities, Accounts, and Contacts efficiently
CREATE OR REPLACE FUNCTION search_global(
    p_query TEXT,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    entity_type TEXT,
    id UUID,
    title TEXT,
    subtitle TEXT,
    metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Normalize query for simple partial matching
    -- In a real production sceneario with millions of rows, Full Text Search (tsvector) is better.
    -- For now, ILIKE is sufficient for <50k rows per table if indexed properly or acceptable lag.
    
    RETURN QUERY
    
    -- 1. Opportunities
    (SELECT 
        'opportunity'::TEXT as entity_type,
        o.id,
        o.nombre as title,
        c.nombre as subtitle, -- Account Name as context
        jsonb_build_object(
            'amount', o.amount, 
            'currency', o.currency_id,
            'fase', o.fase_id
        ) as metadata
     FROM "CRM_Oportunidades" o
     LEFT JOIN "CRM_Cuentas" c ON o.account_id = c.id
     WHERE (o.nombre ILIKE '%' || p_query || '%')
     ORDER BY o.updated_at DESC
     LIMIT p_limit)

    UNION ALL

    -- 2. Accounts
    (SELECT 
        'account'::TEXT as entity_type,
        a.id,
        a.nombre as title,
        COALESCE(a.city, 'Sin ciudad') as subtitle,
        jsonb_build_object('nit', a.nit, 'channel', a.canal_id) as metadata
     FROM "CRM_Cuentas" a
     WHERE (a.nombre ILIKE '%' || p_query || '%' OR a.nit ILIKE p_query || '%')
     LIMIT p_limit)

    UNION ALL

    -- 3. Contacts
    (SELECT 
        'contact'::TEXT as entity_type,
        ct.id,
        ct.nombre as title,
        ct.email as subtitle,
        jsonb_build_object('phone', ct.telefono, 'position', ct.cargo) as metadata
     FROM "CRM_Contactos" ct
     WHERE (ct.nombre ILIKE '%' || p_query || '%' OR ct.email ILIKE '%' || p_query || '%')
     LIMIT p_limit);

END;
$$;
