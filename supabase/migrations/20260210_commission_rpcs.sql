-- =============================================================================
-- COMMISSION ENGINE: RPC Functions
-- calculate_devengada, record_pagada, adjustments, bulk uploads
-- Date: 2026-02-10
-- Depends on: all previous commission migrations
-- =============================================================================

-- =============================================================================
-- HELPER: Record Reversal (Moved up for dependency)
-- =============================================================================
CREATE OR REPLACE FUNCTION record_commission_reversal(
    p_entrada_referencia_id UUID,
    p_motivo TEXT,
    p_reversed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ref RECORD;
BEGIN
    SELECT * INTO v_ref FROM "CRM_ComisionLedger" WHERE id = p_entrada_referencia_id;
    IF v_ref IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entrada de referencia no encontrada');
    END IF;

    -- Check not already reversed
    IF EXISTS (
        SELECT 1 FROM "CRM_ComisionLedger"
        WHERE entrada_referencia_id = p_entrada_referencia_id AND tipo_evento = 'REVERSO'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta entrada ya fue reversada');
    END IF;

    INSERT INTO "CRM_ComisionLedger" (
        tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
        base_amount, currency_id, porcentaje_comision, monto_comision,
        regla_id, regla_snapshot, categoria_id, categoria_snapshot,
        entrada_referencia_id, motivo, created_by
    ) VALUES (
        'REVERSO', v_ref.oportunidad_id, v_ref.cotizacion_id,
        v_ref.vendedor_id, v_ref.cuenta_id, v_ref.canal_id,
        v_ref.base_amount, v_ref.currency_id,
        v_ref.porcentaje_comision, -(v_ref.monto_comision),
        v_ref.regla_id, v_ref.regla_snapshot,
        v_ref.categoria_id, v_ref.categoria_snapshot,
        p_entrada_referencia_id, p_motivo,
        COALESCE(p_reversed_by, auth.uid())
    );

    RETURN jsonb_build_object('success', true, 'reversed_amount', -(v_ref.monto_comision));
END;
$$;


-- =============================================================================
-- MAIN: Calculate DEVENGADA
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_devengada(
    p_oportunidad_id UUID,
    p_triggered_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_commission NUMERIC(15,2);
    v_existing_devengada RECORD;
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

    -- 3. Idempotency & Self-Correction Logic
    SELECT id, cotizacion_id INTO v_existing_devengada
    FROM "CRM_ComisionLedger"
    WHERE oportunidad_id = p_oportunidad_id 
      AND tipo_evento = 'DEVENGADA'
      -- Ensure we don't pick up a reversed entry as "existing active"
      AND NOT EXISTS (
          SELECT 1 FROM "CRM_ComisionLedger" r 
          WHERE r.entrada_referencia_id = "CRM_ComisionLedger".id 
          AND r.tipo_evento = 'REVERSO'
      )
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_existing_devengada.id IS NOT NULL THEN
        -- Case A: Generic commission exists (no quote), but now we HAVE a winner quote -> Upgrade!
        IF v_existing_devengada.cotizacion_id IS NULL AND v_winner_quote IS NOT NULL THEN
            PERFORM record_commission_reversal(
                v_existing_devengada.id,
                'Auto-correction: Winner Quote found after Opportunity Closed',
                p_triggered_by
            );
            -- Proceed to calculate detailed commission...
        ELSE
            -- Case B: Already detailed, or still no quote -> Stop.
            RETURN jsonb_build_object('success', false, 'error', 'DEVENGADA activa ya registrada para esta oportunidad');
        END IF;
    END IF;

    -- 4a. No winner quote: use opportunity amount directly (Fallback / General Rule)
    IF v_winner_quote IS NULL THEN
        SELECT * INTO v_rule
        FROM resolve_commission_rule(
            v_opp.owner_user_id,
            v_opp.account_id,
            NULL, -- Category wildcard
            v_opp.canal_id,
            CURRENT_DATE
        );

        IF v_rule.rule_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No se encontro regla de comision aplicable (General)');
        END IF;

        v_commission := ROUND(v_opp.amount * v_rule.porcentaje_comision / 100, 2);

        INSERT INTO "CRM_ComisionLedger" (
            tipo_evento, oportunidad_id, vendedor_id, cuenta_id, canal_id,
            base_amount, currency_id, porcentaje_comision, monto_comision,
            regla_id, regla_snapshot, created_by
        ) VALUES (
            'DEVENGADA', p_oportunidad_id, v_opp.owner_user_id, v_opp.account_id, v_opp.canal_id,
            v_opp.amount, COALESCE(v_opp.currency_id, 'COP'), v_rule.porcentaje_comision, v_commission,
            v_rule.rule_id, v_rule.rule_snapshot, p_triggered_by
        );

        RETURN jsonb_build_object('success', true, 'entries', 1, 'total_commission', v_commission, 'type', 'GENERAL');
    END IF;

    -- 4b. Process each line item in the winner quote (Detailed Mode)
    FOR v_item IN
        SELECT qi.id, qi.cantidad, qi.precio_unitario, qi.final_unit_price, qi.producto_id,
               lp.numero_articulo
        FROM "CRM_CotizacionItems" qi
        LEFT JOIN "CRM_ListaDePrecios" lp ON qi.producto_id = lp.id
        WHERE qi.cotizacion_id = v_winner_quote.id
    LOOP
        -- Resolve category from numero_articulo prefix
        v_category_id := NULL;
        IF v_item.numero_articulo IS NOT NULL THEN
            SELECT cc.id INTO v_category_id
            FROM "CRM_ComisionCategorias" cc
            WHERE cc.prefijo = LEFT(v_item.numero_articulo, 6)
              AND cc.is_active = TRUE;
        END IF;

        -- Resolve best rule for this item
        SELECT * INTO v_rule
        FROM resolve_commission_rule(
            v_opp.owner_user_id,
            v_opp.account_id,
            v_category_id,
            v_opp.canal_id,
            CURRENT_DATE
        );

        IF v_rule.rule_id IS NOT NULL THEN
            v_item_amount := COALESCE(v_item.final_unit_price, v_item.precio_unitario) * v_item.cantidad;
            v_commission := ROUND(v_item_amount * v_rule.porcentaje_comision / 100, 2);

            INSERT INTO "CRM_ComisionLedger" (
                tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
                base_amount, currency_id, porcentaje_comision, monto_comision,
                regla_id, regla_snapshot,
                categoria_id, categoria_snapshot,
                created_by
            ) VALUES (
                'DEVENGADA', p_oportunidad_id, v_winner_quote.id,
                v_opp.owner_user_id, v_opp.account_id, v_opp.canal_id,
                v_item_amount, COALESCE(v_opp.currency_id, 'COP'), v_rule.porcentaje_comision, v_commission,
                v_rule.rule_id, v_rule.rule_snapshot,
                v_category_id,
                CASE WHEN v_category_id IS NOT NULL THEN
                    (SELECT jsonb_build_object('id', cc.id, 'prefijo', cc.prefijo, 'nombre', cc.nombre)
                     FROM "CRM_ComisionCategorias" cc WHERE cc.id = v_category_id)
                ELSE NULL END,
                p_triggered_by
            );

            v_total_commission := v_total_commission + v_commission;
            v_entries_created := v_entries_created + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'entries', v_entries_created,
        'total_commission', v_total_commission,
        'quote_id', v_winner_quote.id,
        'type', 'DETAILED'
    );
END;
$$;


-- =============================================================================
-- HELPER: Record PAGADA
-- =============================================================================
CREATE OR REPLACE FUNCTION record_commission_pagada(
    p_oportunidad_id UUID,
    p_sap_payment_ref VARCHAR(100),
    p_recorded_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_devengada RECORD;
    v_total NUMERIC(15,2) := 0;
    v_count INT := 0;
BEGIN
    -- Idempotency
    IF EXISTS (
        SELECT 1 FROM "CRM_ComisionLedger"
        WHERE oportunidad_id = p_oportunidad_id AND tipo_evento = 'PAGADA'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'PAGADA ya registrada para esta oportunidad');
    END IF;

    -- Mirror each ACTIVE (not reversed) DEVENGADA as PAGADA
    FOR v_devengada IN
        SELECT * FROM "CRM_ComisionLedger" l
        WHERE oportunidad_id = p_oportunidad_id 
          AND tipo_evento = 'DEVENGADA'
          AND NOT EXISTS (
              SELECT 1 FROM "CRM_ComisionLedger" r 
              WHERE r.entrada_referencia_id = l.id 
              AND r.tipo_evento = 'REVERSO'
          )
    LOOP
        INSERT INTO "CRM_ComisionLedger" (
            tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
            base_amount, currency_id, porcentaje_comision, monto_comision,
            regla_id, regla_snapshot, categoria_id, categoria_snapshot,
            entrada_referencia_id, sap_payment_ref,
            created_by
        ) VALUES (
            'PAGADA', v_devengada.oportunidad_id, v_devengada.cotizacion_id,
            v_devengada.vendedor_id, v_devengada.cuenta_id, v_devengada.canal_id,
            v_devengada.base_amount, v_devengada.currency_id,
            v_devengada.porcentaje_comision, v_devengada.monto_comision,
            v_devengada.regla_id, v_devengada.regla_snapshot,
            v_devengada.categoria_id, v_devengada.categoria_snapshot,
            v_devengada.id,
            p_sap_payment_ref,
            COALESCE(p_recorded_by, auth.uid())
        );

        v_total := v_total + v_devengada.monto_comision;
        v_count := v_count + 1;
    END LOOP;

    IF v_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay entradas DEVENGADA activas para esta oportunidad');
    END IF;

    RETURN jsonb_build_object('success', true, 'entries', v_count, 'total_paid', v_total);
END;
$$;


-- =============================================================================
-- HELPER: Record Adjustment
-- =============================================================================
CREATE OR REPLACE FUNCTION record_commission_adjustment(
    p_entrada_referencia_id UUID,
    p_monto_ajuste NUMERIC(15,2),
    p_motivo TEXT,
    p_adjusted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ref RECORD;
BEGIN
    SELECT * INTO v_ref FROM "CRM_ComisionLedger" WHERE id = p_entrada_referencia_id;
    IF v_ref IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entrada de referencia no encontrada');
    END IF;

    INSERT INTO "CRM_ComisionLedger" (
        tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
        base_amount, currency_id, porcentaje_comision, monto_comision,
        regla_id, regla_snapshot, categoria_id, categoria_snapshot,
        entrada_referencia_id, motivo, created_by
    ) VALUES (
        'AJUSTE', v_ref.oportunidad_id, v_ref.cotizacion_id,
        v_ref.vendedor_id, v_ref.cuenta_id, v_ref.canal_id,
        v_ref.base_amount, v_ref.currency_id,
        v_ref.porcentaje_comision, p_monto_ajuste,
        v_ref.regla_id, v_ref.regla_snapshot,
        v_ref.categoria_id, v_ref.categoria_snapshot,
        p_entrada_referencia_id, p_motivo,
        COALESCE(p_adjusted_by, auth.uid())
    );

    RETURN jsonb_build_object('success', true, 'adjusted_amount', p_monto_ajuste);
END;
$$;

-- 5. Bulk upsert rules from CSV
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
            nombre, vendedor_id, cuenta_id, categoria_id, canal_id,
            porcentaje_comision, vigencia_desde, vigencia_hasta,
            is_active, created_by, updated_by
        ) VALUES (
            v_rule->>'nombre',
            NULLIF(v_rule->>'vendedor_id', '')::UUID,
            NULLIF(v_rule->>'cuenta_id', '')::UUID,
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


-- 6. Bulk upsert categories from CSV
CREATE OR REPLACE FUNCTION admin_upsert_commission_categories(p_categories JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_cat JSONB;
BEGIN
    FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories)
    LOOP
        INSERT INTO "CRM_ComisionCategorias" (prefijo, nombre, descripcion)
        VALUES (
            v_cat->>'prefijo',
            v_cat->>'nombre',
            v_cat->>'descripcion'
        )
        ON CONFLICT (prefijo) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            descripcion = EXCLUDED.descripcion,
            updated_at = NOW();
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'categories_upserted', v_count);
END;
$$;
