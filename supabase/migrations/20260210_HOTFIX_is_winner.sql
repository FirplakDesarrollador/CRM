-- =============================================================================
-- HOTFIX: Remove non-existent column 'is_winner' from all references
-- Date: 2026-02-10
-- =============================================================================

-- 1. Fix trigger function for Quotes
CREATE OR REPLACE FUNCTION trg_auto_devengada_on_quote_win()
RETURNS TRIGGER AS $$
DECLARE
    v_opp_status INT;
    v_result JSONB;
BEGIN
    -- Only fire when status changes to WINNER
    IF (NEW.status = 'WINNER' AND (OLD.status IS DISTINCT FROM 'WINNER')) THEN
        
        -- Check if Parent Opportunity is WON (estado_id = 2)
        SELECT estado_id INTO v_opp_status
        FROM "CRM_Oportunidades"
        WHERE id = NEW.opportunity_id;

        IF v_opp_status = 2 THEN
            -- Trigger calculation
            SELECT calculate_devengada(NEW.opportunity_id, '00000000-0000-0000-0000-000000000000') INTO v_result;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix main RPC function
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
    -- Get opportunity + account data
    SELECT o.id, o.owner_user_id, o.account_id, o.amount, o.currency_id, o.estado_id,
           c.canal_id
    INTO v_opp
    FROM "CRM_Oportunidades" o
    JOIN "CRM_Cuentas" c ON o.account_id = c.id
    WHERE o.id = p_oportunidad_id AND o.estado_id = 2;

    IF v_opp IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Oportunidad no encontrada o no esta en estado Ganada');
    END IF;

    -- Find the WINNER quote (removed is_winner column)
    SELECT * INTO v_winner_quote
    FROM "CRM_Cotizaciones"
    WHERE opportunity_id = p_oportunidad_id
      AND (status = 'WINNER')
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Idempotency
    SELECT id, cotizacion_id INTO v_existing_devengada
    FROM "CRM_ComisionLedger"
    WHERE oportunidad_id = p_oportunidad_id 
      AND tipo_evento = 'DEVENGADA'
      AND NOT EXISTS (
          SELECT 1 FROM "CRM_ComisionLedger" r 
          WHERE r.entrada_referencia_id = "CRM_ComisionLedger".id 
          AND r.tipo_evento = 'REVERSO'
      )
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_existing_devengada.id IS NOT NULL THEN
        IF v_existing_devengada.cotizacion_id IS NULL AND v_winner_quote IS NOT NULL THEN
            PERFORM record_commission_reversal(
                v_existing_devengada.id,
                'Auto-correction: Winner Quote found after Opportunity Closed',
                p_triggered_by
            );
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'DEVENGADA activa ya registrada para esta oportunidad');
        END IF;
    END IF;

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

    FOR v_item IN
        SELECT qi.id, qi.cantidad, qi.precio_unitario, qi.final_unit_price, qi.producto_id,
               lp.numero_articulo
        FROM "CRM_CotizacionItems" qi
        LEFT JOIN "CRM_ListaDePrecios" lp ON qi.producto_id = lp.id
        WHERE qi.cotizacion_id = v_winner_quote.id
    LOOP
        v_category_id := NULL;
        IF v_item.numero_articulo IS NOT NULL THEN
            SELECT cc.id INTO v_category_id
            FROM "CRM_ComisionCategorias" cc
            WHERE cc.prefijo = LEFT(v_item.numero_articulo, 6)
              AND cc.is_active = TRUE;
        END IF;

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
