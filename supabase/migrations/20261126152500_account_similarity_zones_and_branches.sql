-- =============================================================================
-- MIGRATION: 20261126152500_account_similarity_zones_and_branches.sql
-- 1. Tabla configurable CRM_Zonas y columna zona_id en CRM_Usuarios
-- 2. Ajuste de unique_active_nit para permitir sucursales con mismo nit_base
-- 3. Funciones/índices pg_trgm + unaccent y RPC SECURITY DEFINER search_similar_accounts
-- =============================================================================

-- 1. Tabla configurable de Zonas Comerciales
CREATE TABLE IF NOT EXISTS public."CRM_Zonas" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    codigo TEXT NOT NULL UNIQUE,
    orden INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public."CRM_Zonas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read zones" ON public."CRM_Zonas";
CREATE POLICY "Authenticated users can read zones"
ON public."CRM_Zonas"
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage zones" ON public."CRM_Zonas";
CREATE POLICY "Admins can manage zones"
ON public."CRM_Zonas"
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public."CRM_Usuarios" u
        WHERE u.id = auth.uid()
          AND u.role = 'ADMIN'
          AND u.is_active = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public."CRM_Usuarios" u
        WHERE u.id = auth.uid()
          AND u.role = 'ADMIN'
          AND u.is_active = TRUE
    )
);

-- Semilla inicial editable desde /configuracion
INSERT INTO public."CRM_Zonas" (nombre, codigo, orden)
VALUES
    ('Antioquia', 'antioquia', 10),
    ('Centro', 'centro', 20),
    ('Costa', 'costa', 30),
    ('Valle', 'valle', 40),
    ('Eje Cafetero', 'eje_cafetero', 50),
    ('Santanderes', 'santanderes', 60),
    ('Internacional', 'internacional', 70)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Columna zona_id en CRM_Usuarios
ALTER TABLE public."CRM_Usuarios"
    ADD COLUMN IF NOT EXISTS zona_id UUID REFERENCES public."CRM_Zonas"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_usuarios_zona_id
    ON public."CRM_Usuarios" (zona_id);

-- 3. Permitir que las sucursales (id_cuenta_principal IS NOT NULL) compartan el nit_base de la matriz
-- La unicidad de nit_base activo aplica únicamente a cuentas raíz; las sucursales se distinguen con nit_sufijo.
DROP INDEX IF EXISTS public.unique_active_nit;
CREATE UNIQUE INDEX unique_active_nit
    ON public."CRM_Cuentas" USING btree (nit_base)
    WHERE (
        is_deleted = false
        AND id_cuenta_principal IS NULL
        AND nit_base IS NOT NULL
        AND (nit_base)::text <> ''::text
    );

-- 4. Funciones inmutables para normalización de nombre y extracción de raíz numérica de NIT
CREATE OR REPLACE FUNCTION public.crm_normalize_account_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    SELECT trim(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    lower(public.unaccent('public.unaccent'::regdictionary, p_name)),
                    '[^a-z0-9\s]',
                    ' ',
                    'g'
                ),
                '\m(s\s*a\s*s|s\s*a|ltda|limitada|cia|e\s*u|s\s*en\s*c|inc|llc|corp)\M',
                ' ',
                'gi'
            ),
            '\s+',
            ' ',
            'g'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.crm_extract_nit_root(p_nit TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN p_nit IS NULL OR trim(p_nit) = '' OR trim(p_nit) ~* '^PROV-' THEN ''
        ELSE regexp_replace(split_part(trim(p_nit), '-', 1), '[^0-9]', '', 'g')
    END;
$$;

-- Índices para búsqueda rápida sobre 50k+ cuentas activas
CREATE INDEX IF NOT EXISTS idx_crm_cuentas_nombre_norm_trgm
    ON public."CRM_Cuentas"
    USING gin (public.crm_normalize_account_name(nombre) public.gin_trgm_ops)
    WHERE (is_deleted = false);

CREATE INDEX IF NOT EXISTS idx_crm_cuentas_nit_root
    ON public."CRM_Cuentas"
    USING btree (public.crm_extract_nit_root(nit_base))
    WHERE (is_deleted = false);

-- 5. RPC SECURITY DEFINER de búsqueda por similitud sin exponer datos sensibles de contacto
CREATE OR REPLACE FUNCTION public.search_similar_accounts(
    p_nombre TEXT DEFAULT NULL,
    p_nit TEXT DEFAULT NULL,
    p_exclude_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 6
)
RETURNS TABLE (
    id UUID,
    nombre VARCHAR,
    nit_base VARCHAR,
    canal_id VARCHAR,
    id_cuenta_principal UUID,
    root_id UUID,
    root_nombre VARCHAR,
    root_nit_base VARCHAR,
    owner_user_id UUID,
    owner_name VARCHAR,
    owner_zona TEXT,
    match_reason TEXT,
    similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_norm_name TEXT;
    v_nit_root TEXT;
    v_safe_limit INT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_norm_name := CASE
        WHEN p_nombre IS NULL OR trim(p_nombre) = '' THEN ''
        ELSE public.crm_normalize_account_name(p_nombre)
    END;
    v_nit_root := public.crm_extract_nit_root(p_nit);
    v_safe_limit := LEAST(GREATEST(COALESCE(p_limit, 6), 1), 15);

    IF length(v_norm_name) < 3 AND length(v_nit_root) < 5 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT
            c.id,
            c.nombre,
            c.nit_base,
            c.canal_id,
            c.id_cuenta_principal,
            COALESCE(root_acc.id, c.id) AS root_id,
            COALESCE(root_acc.nombre, c.nombre) AS root_nombre,
            COALESCE(root_acc.nit_base, c.nit_base) AS root_nit_base,
            c.owner_user_id,
            u.full_name AS owner_name,
            z.nombre AS owner_zona,
            (length(v_nit_root) >= 5 AND public.crm_extract_nit_root(c.nit_base) = v_nit_root) AS is_nit_match,
            CASE
                WHEN length(v_norm_name) >= 3 THEN
                    GREATEST(
                        public.similarity(public.crm_normalize_account_name(c.nombre), v_norm_name),
                        CASE
                            WHEN public.crm_normalize_account_name(c.nombre) = v_norm_name THEN 1.0::real
                            WHEN length(v_norm_name) >= 4
                                 AND (
                                     public.crm_normalize_account_name(c.nombre) LIKE '%' || v_norm_name || '%'
                                     OR (
                                         length(public.crm_normalize_account_name(c.nombre)) >= 4
                                         AND v_norm_name LIKE '%' || public.crm_normalize_account_name(c.nombre) || '%'
                                     )
                                 ) THEN 0.75::real
                            ELSE 0.0::real
                        END
                    )
                ELSE 0.0::real
            END AS name_sim
        FROM public."CRM_Cuentas" c
        LEFT JOIN public."CRM_Cuentas" root_acc
            ON root_acc.id = c.id_cuenta_principal
        LEFT JOIN public."CRM_Usuarios" u
            ON u.id = c.owner_user_id
        LEFT JOIN public."CRM_Zonas" z
            ON z.id = u.zona_id
        WHERE c.is_deleted = false
          AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
          AND (
              (length(v_nit_root) >= 5 AND public.crm_extract_nit_root(c.nit_base) = v_nit_root)
              OR (
                  length(v_norm_name) >= 3
                  AND (
                      public.crm_normalize_account_name(c.nombre) % v_norm_name
                      OR public.crm_normalize_account_name(c.nombre) LIKE '%' || v_norm_name || '%'
                  )
              )
          )
    )
    SELECT
        cand.id,
        cand.nombre,
        cand.nit_base,
        cand.canal_id,
        cand.id_cuenta_principal,
        cand.root_id,
        cand.root_nombre,
        cand.root_nit_base,
        cand.owner_user_id,
        cand.owner_name,
        cand.owner_zona,
        CASE
            WHEN cand.is_nit_match AND cand.name_sim >= 0.3 THEN 'AMBOS'
            WHEN cand.is_nit_match THEN 'NIT'
            ELSE 'NOMBRE'
        END AS match_reason,
        cand.name_sim AS similarity_score
    FROM candidates cand
    ORDER BY
        cand.is_nit_match DESC,
        cand.name_sim DESC,
        (cand.id_cuenta_principal IS NULL) DESC,
        cand.nombre ASC
    LIMIT v_safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_similar_accounts(TEXT, TEXT, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_similar_accounts(TEXT, TEXT, UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
