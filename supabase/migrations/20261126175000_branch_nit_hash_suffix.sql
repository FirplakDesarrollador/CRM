-- =============================================================================
-- MIGRATION: 20261126175000_branch_nit_hash_suffix.sql
-- 1. Actualiza crm_extract_nit_root para soportar sufijos de sucursal #N (ej. 900510728-6#2)
-- 2. Agrega RPC SECURITY DEFINER get_next_branch_nit(p_parent_id) para calcular
--    automáticamente el siguiente NIT de sucursal (NIT padre + #2, #3, ...)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crm_extract_nit_root(p_nit TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN p_nit IS NULL OR trim(p_nit) = '' OR trim(p_nit) ~* '^PROV-' THEN ''
        ELSE regexp_replace(split_part(split_part(trim(p_nit), '#', 1), '-', 1), '[^0-9]', '', 'g')
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_branch_nit(p_parent_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_root_id UUID;
    v_parent_nit TEXT;
    v_base_nit TEXT;
    v_branch_count INT := 0;
    v_max_hash INT := 0;
    v_next_num INT := 2;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_parent_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(c.id_cuenta_principal, c.id)
    INTO v_root_id
    FROM public."CRM_Cuentas" c
    WHERE c.id = p_parent_id
      AND c.is_deleted = false
    LIMIT 1;

    IF v_root_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT trim(COALESCE(c.nit_base, ''))
    INTO v_parent_nit
    FROM public."CRM_Cuentas" c
    WHERE c.id = v_root_id
    LIMIT 1;

    v_base_nit := trim(split_part(v_parent_nit, '#', 1));
    IF v_base_nit = '' THEN
        RETURN NULL;
    END IF;

    SELECT
        COUNT(*)::INT,
        COALESCE(
            MAX(
                CASE
                    WHEN c.nit_base ~ '#[0-9]+$' THEN (substring(c.nit_base FROM '#([0-9]+)$'))::INT
                    ELSE 0
                END
            ),
            0
        )
    INTO v_branch_count, v_max_hash
    FROM public."CRM_Cuentas" c
    WHERE c.id_cuenta_principal = v_root_id
      AND c.is_deleted = false;

    v_next_num := GREATEST(v_branch_count + 2, v_max_hash + 1, 2);

    RETURN v_base_nit || '#' || v_next_num::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_branch_nit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_branch_nit(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
