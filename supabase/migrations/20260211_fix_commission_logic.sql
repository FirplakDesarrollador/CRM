-- Migration: Fix Commission Logic (Specificity & Splits)
-- Date: 2026-02-11
-- Description: 
-- 1. Updates resolve_commission_rule to prioritize Specificity over Lowest Value.
-- 2. Updates calculate_devengada to handle Split Commissions (Collaborators).

-- =============================================================================
-- 1. FIX RULE PRIORITY (Specificity > Value)
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
      AND (r.vendedor_id IS NULL OR r.vendedor_id = p_vendedor_id)
      AND (r.cuenta_id IS NULL OR r.cuenta_id = p_cuenta_id)
      AND (r.categoria_id IS NULL OR r.categoria_id = p_categoria_id)
      AND (r.canal_id IS NULL OR r.canal_id = p_canal_id)
      AND r.vigencia_desde <= p_fecha
      AND (r.vigencia_hasta IS NULL OR r.vigencia_hasta >= p_fecha)
    
    -- PRIMARY SORT: Specificity (Highest Score First)
    -- SECONDARY SORT: Percentage (Lowest First) - "Tie-Breaker"
    ORDER BY 
        priority_score DESC, 
        r.porcentaje_comision ASC, 
        r.created_at DESC
    LIMIT 1;
END;
$$;

-- =============================================================================
-- 2. FIX DEVENGADA CALCULATION (Support Splits)
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_devengada(
    p_oportunidad_id UUID,
    p_triggered_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opp RECORD;
    v_winner_quote RECORD;
    v_item RECORD;
    v_rule RECORD;
    v_total_commission NUMERIC(15,2) := 0;
    v_entries_created INT := 0;
    v_category_id INT;
    v_item_amount NUMERIC(15,2);
    v_gross_commission NUMERIC(15,2); -- Total commission before split
    v_final_commission NUMERIC(15,2); -- Share for specific user
    v_existing_devengada RECORD;
    v_collab RECORD;
    v_collaborators_count INT := 0;
    v_owner_share NUMERIC(5,2) := 100;
    v_total_collab_percent NUMERIC(5,2) := 0;
BEGIN
    -- 1. Get opportunity + account data
    SELECT o.id, o.owner_user_id, o.account_id, o.amount, o.currency_id, o.estado_id,
           c.canal_id
    INTO v_opp
    FROM "CRM_Oportunidades" o
    JOIN "CRM_Cuentas" c ON o.account_id = c.id
    WHERE o.id = p_oportunidad_id AND o.estado_id = 2; -- Must be WON

    IF v_opp IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Oportunidad no encontrada o no esta en estado Ganada');
    END IF;

    -- 2. Find the WINNER quote
    SELECT * INTO v_winner_quote
    FROM "CRM_Cotizaciones"
    WHERE opportunity_id = p_oportunidad_id
      AND (status = 'WINNER')
    ORDER BY updated_at DESC
    LIMIT 1;

    -- 3. Idempotency Check
    SELECT id FROM "CRM_ComisionLedger"
    WHERE oportunidad_id = p_oportunidad_id 
      AND tipo_evento = 'DEVENGADA'
      AND NOT EXISTS (
          SELECT 1 FROM "CRM_ComisionLedger" r 
          WHERE r.entrada_referencia_id = "CRM_ComisionLedger".id 
          AND r.tipo_evento = 'REVERSO'
      )
    INTO v_existing_devengada;

    IF v_existing_devengada IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'DEVENGADA activa ya registrada');
    END IF;

    -- 4. Calculate Splits (Collaborators)
    -- Calculate how much share the owner keeps.
    SELECT COALESCE(SUM(porcentaje), 0) INTO v_total_collab_percent
    FROM "CRM_Oportunidades_Colaboradores"
    WHERE oportunidad_id = p_oportunidad_id;

    -- If owner is NOT in the collaborators list, they get the remainder.
    -- If owner IS in the list (explicit split), we handle that in the loop below.
    -- Logic: We will iterate ALL beneficiaries.
    -- If NO collaborators table entries, we treat Owner as 100%.
    
    -- Mode A: No Quote (General)
    IF v_winner_quote IS NULL THEN
        SELECT * INTO v_rule
        FROM resolve_commission_rule(
            v_opp.owner_user_id,
            v_opp.account_id,
            NULL,
            v_opp.canal_id,
            CURRENT_DATE
        );

        IF v_rule.rule_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No se encontro regla');
        END IF;

        v_gross_commission := ROUND(v_opp.amount * v_rule.porcentaje_comision / 100, 2);

        -- Distribute to Collaborators
        FOR v_collab IN 
            SELECT usuario_id, porcentaje FROM "CRM_Oportunidades_Colaboradores"
            WHERE oportunidad_id = p_oportunidad_id
        LOOP
            v_final_commission := ROUND(v_gross_commission * (v_collab.porcentaje / 100), 2);
            
            INSERT INTO "CRM_ComisionLedger" (
                tipo_evento, oportunidad_id, vendedor_id, cuenta_id, canal_id,
                base_amount, currency_id, porcentaje_comision, monto_comision,
                regla_id, regla_snapshot, created_by, sap_payment_ref -- abusing sap_ref for notes? no, simplify
            ) VALUES (
                'DEVENGADA', p_oportunidad_id, v_collab.usuario_id, v_opp.account_id, v_opp.canal_id,
                v_opp.amount, COALESCE(v_opp.currency_id, 'COP'), v_rule.porcentaje_comision, v_final_commission,
                v_rule.rule_id, v_rule.rule_snapshot, p_triggered_by, NULL
            );
            v_entries_created := v_entries_created + 1;
            v_total_commission := v_total_commission + v_final_commission;
        END LOOP;

        -- Distribute Remainder to Owner (if not fully covered and owner not explicit)
        -- Check if owner was already paid above?
        -- Simplification: If owner is in collaborators, they got paid. If not, they get (100 - sum).
        IF NOT EXISTS (SELECT 1 FROM "CRM_Oportunidades_Colaboradores" WHERE oportunidad_id = p_oportunidad_id AND usuario_id = v_opp.owner_user_id) THEN
            v_owner_share := GREATEST(0, 100 - v_total_collab_percent);
            
            IF v_owner_share > 0 THEN
                v_final_commission := ROUND(v_gross_commission * (v_owner_share / 100), 2);
                
                INSERT INTO "CRM_ComisionLedger" (
                    tipo_evento, oportunidad_id, vendedor_id, cuenta_id, canal_id,
                    base_amount, currency_id, porcentaje_comision, monto_comision,
                    regla_id, regla_snapshot, created_by
                ) VALUES (
                    'DEVENGADA', p_oportunidad_id, v_opp.owner_user_id, v_opp.account_id, v_opp.canal_id,
                    v_opp.amount, COALESCE(v_opp.currency_id, 'COP'), v_rule.porcentaje_comision, v_final_commission,
                    v_rule.rule_id, v_rule.rule_snapshot, p_triggered_by
                );
                v_entries_created := v_entries_created + 1;
                v_total_commission := v_total_commission + v_final_commission;
            END IF;
        END IF;

        RETURN jsonb_build_object('success', true, 'entries', v_entries_created, 'total_commission', v_total_commission);
    END IF;

    -- Mode B: Detailed (With Quote)
    FOR v_item IN
        SELECT qi.id, qi.cantidad, qi.precio_unitario, qi.final_unit_price, qi.producto_id, lp.numero_articulo
        FROM "CRM_CotizacionItems" qi
        LEFT JOIN "CRM_ListaDePrecios" lp ON qi.producto_id = lp.id
        WHERE qi.cotizacion_id = v_winner_quote.id
    LOOP
        -- Resolve Category
        v_category_id := NULL;
        IF v_item.numero_articulo IS NOT NULL THEN
            SELECT cc.id INTO v_category_id FROM "CRM_ComisionCategorias" cc WHERE cc.prefijo = LEFT(v_item.numero_articulo, 6) AND cc.is_active = TRUE;
        END IF;

        -- Resolve Rule
        SELECT * INTO v_rule FROM resolve_commission_rule(v_opp.owner_user_id, v_opp.account_id, v_category_id, v_opp.canal_id, CURRENT_DATE);

        IF v_rule.rule_id IS NOT NULL THEN
            v_item_amount := COALESCE(v_item.final_unit_price, v_item.precio_unitario) * v_item.cantidad;
            v_gross_commission := ROUND(v_item_amount * v_rule.porcentaje_comision / 100, 2);

            -- Distribute to Collaborators
            FOR v_collab IN SELECT usuario_id, porcentaje FROM "CRM_Oportunidades_Colaboradores" WHERE oportunidad_id = p_oportunidad_id LOOP
                v_final_commission := ROUND(v_gross_commission * (v_collab.porcentaje / 100), 2);
                
                INSERT INTO "CRM_ComisionLedger" (
                    tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
                    base_amount, currency_id, porcentaje_comision, monto_comision,
                    regla_id, regla_snapshot, categoria_id, categoria_snapshot, created_by
                ) VALUES (
                    'DEVENGADA', p_oportunidad_id, v_winner_quote.id, v_collab.usuario_id, v_opp.account_id, v_opp.canal_id,
                    v_item_amount, COALESCE(v_opp.currency_id, 'COP'), v_rule.porcentaje_comision, v_final_commission,
                    v_rule.rule_id, v_rule.rule_snapshot, v_category_id, 
                    (CASE WHEN v_category_id IS NOT NULL THEN (SELECT jsonb_build_object('id', cc.id, 'nombre', cc.nombre) FROM "CRM_ComisionCategorias" cc WHERE cc.id = v_category_id) ELSE NULL END),
                    p_triggered_by
                );
                v_total_commission := v_total_commission + v_final_commission;
                v_entries_created := v_entries_created + 1;
            END LOOP;

            -- Distribute to Owner (Remainder)
             IF NOT EXISTS (SELECT 1 FROM "CRM_Oportunidades_Colaboradores" WHERE oportunidad_id = p_oportunidad_id AND usuario_id = v_opp.owner_user_id) THEN
                v_owner_share := GREATEST(0, 100 - v_total_collab_percent);
                IF v_owner_share > 0 THEN
                     v_final_commission := ROUND(v_gross_commission * (v_owner_share / 100), 2);
                     INSERT INTO "CRM_ComisionLedger" (
                        tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
                        base_amount, currency_id, porcentaje_comision, monto_comision,
                        regla_id, regla_snapshot, categoria_id, categoria_snapshot, created_by
                    ) VALUES (
                        'DEVENGADA', p_oportunidad_id, v_winner_quote.id, v_opp.owner_user_id, v_opp.account_id, v_opp.canal_id,
                        v_item_amount, COALESCE(v_opp.currency_id, 'COP'), v_rule.porcentaje_comision, v_final_commission,
                        v_rule.rule_id, v_rule.rule_snapshot, v_category_id, 
                        (CASE WHEN v_category_id IS NOT NULL THEN (SELECT jsonb_build_object('id', cc.id, 'nombre', cc.nombre) FROM "CRM_ComisionCategorias" cc WHERE cc.id = v_category_id) ELSE NULL END),
                        p_triggered_by
                    );
                    v_total_commission := v_total_commission + v_final_commission;
                    v_entries_created := v_entries_created + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'entries', v_entries_created, 'total_commission', v_total_commission, 'type', 'DETAILED');
END;
$$;
