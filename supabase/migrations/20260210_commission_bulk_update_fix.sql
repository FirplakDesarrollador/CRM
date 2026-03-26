-- Update bulk upsert RPC to support accounts array
CREATE OR REPLACE FUNCTION admin_upsert_commission_rules(p_rules JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_rule JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules)
    LOOP
        INSERT INTO "CRM_ComisionReglas" (
            nombre, vendedor_id, cuenta_id, cuentas_ids, categoria_id, canal_id,
            porcentaje_comision, vigencia_desde, vigencia_hasta,
            is_active, created_by, updated_by
        ) VALUES (
            v_rule->>'nombre',
            NULLIF(v_rule->>'vendedor_id', '')::UUID,
            NULLIF(v_rule->>'cuenta_id', '')::UUID,
            (SELECT ARRAY(SELECT jsonb_array_elements_text(v_rule->'cuentas_ids'))::UUID[]),
            NULLIF(v_rule->>'categoria_id', '')::INT,
            NULLIF(v_rule->>'canal_id', ''),
            (v_rule->>'porcentaje_comision')::NUMERIC,
            COALESCE(NULLIF(v_rule->>'vigencia_desde', '')::DATE, CURRENT_DATE),
            NULLIF(v_rule->>'vigencia_hasta', '')::DATE,
            COALESCE((v_rule->>'is_active')::BOOLEAN, TRUE),
            v_user_id,
            v_user_id
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'rules_created', v_count);
END;
$$;
