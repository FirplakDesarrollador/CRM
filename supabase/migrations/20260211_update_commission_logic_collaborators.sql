-- Replaces calculate_devengada to support collaborators/split commissions
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
    v_subtotal_commission NUMERIC(15,2) := 0; -- Commission for the specific item/rule
    v_total_commission_project NUMERIC(15,2) := 0; -- Total commission for the whole project
    v_entries_created INT := 0;
    v_category_id INT;
    v_item_amount NUMERIC(15,2);
    v_existing_devengada RECORD;
    
    -- Collaborator variables
    v_collab RECORD;
    v_total_collab_percent NUMERIC(5,2) := 0;
    v_owner_percent NUMERIC(5,2) := 100;
    v_owner_commission NUMERIC(15,2);
    v_collab_commission NUMERIC(15,2);

    -- Effective percentages (Rule % * Share %)
    v_effective_owner_percent NUMERIC(5,2);
    v_effective_collab_percent NUMERIC(5,2);
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

    -- 2. Check for collaborators and calculate split
    SELECT COALESCE(SUM(porcentaje), 0) INTO v_total_collab_percent
    FROM "CRM_Oportunidades_Colaboradores"
    WHERE oportunidad_id = p_oportunidad_id;

    v_owner_percent := 100 - v_total_collab_percent;
    
    -- Sanity check
    IF v_owner_percent < 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'El porcentaje de colaboradores excede el 100%');
    END IF;

    -- 3. Find the WINNER quote
    SELECT * INTO v_winner_quote
    FROM "CRM_Cotizaciones"
    WHERE opportunity_id = p_oportunidad_id
      AND (status = 'WINNER')
    ORDER BY updated_at DESC
    LIMIT 1;

    -- 4. Idempotency & Self-Correction Logic
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

    -- 5a. No winner quote: use opportunity amount directly (Fallback)
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

        -- Total Commission Amount for the Deal
        v_subtotal_commission := ROUND(v_opp.amount * v_rule.porcentaje_comision / 100, 2);
        
        -- A. Insert for Owner
        v_owner_commission := ROUND(v_subtotal_commission * v_owner_percent / 100, 2);
        v_effective_owner_percent := ROUND(v_rule.porcentaje_comision * v_owner_percent / 100, 2);
        
        IF v_owner_commission > 0 THEN
            INSERT INTO "CRM_ComisionLedger" (
                tipo_evento, oportunidad_id, vendedor_id, cuenta_id, canal_id,
                base_amount, currency_id, porcentaje_comision, monto_comision,
                regla_id, regla_snapshot, created_by,
                notas
            ) VALUES (
                'DEVENGADA', p_oportunidad_id, v_opp.owner_user_id, v_opp.account_id, v_opp.canal_id,
                v_opp.amount, COALESCE(v_opp.currency_id, 'COP'), v_effective_owner_percent, v_owner_commission,
                v_rule.rule_id, v_rule.rule_snapshot, p_triggered_by,
                'Participacion: ' || v_owner_percent || '% (Regla: ' || v_rule.porcentaje_comision || '%)'
            );
            v_entries_created := v_entries_created + 1;
        END IF;
        
        -- B. Insert for Collaborators
        FOR v_collab IN SELECT * FROM "CRM_Oportunidades_Colaboradores" WHERE oportunidad_id = p_oportunidad_id
        LOOP
            v_collab_commission := ROUND(v_subtotal_commission * v_collab.porcentaje / 100, 2);
            v_effective_collab_percent := ROUND(v_rule.porcentaje_comision * v_collab.porcentaje / 100, 2);

             IF v_collab_commission > 0 THEN
                INSERT INTO "CRM_ComisionLedger" (
                    tipo_evento, oportunidad_id, vendedor_id, cuenta_id, canal_id,
                    base_amount, currency_id, porcentaje_comision, monto_comision,
                    regla_id, regla_snapshot, created_by,
                    notas
                ) VALUES (
                    'DEVENGADA', p_oportunidad_id, v_collab.usuario_id, v_opp.account_id, v_opp.canal_id,
                    v_opp.amount, COALESCE(v_opp.currency_id, 'COP'), v_effective_collab_percent, v_collab_commission,
                    v_rule.rule_id, v_rule.rule_snapshot, p_triggered_by,
                    'Participacion (Colaborador): ' || v_collab.porcentaje || '% (Regla: ' || v_rule.porcentaje_comision || '%)'
                );
                v_entries_created := v_entries_created + 1;
            END IF;
        END LOOP;

        RETURN jsonb_build_object('success', true, 'entries', v_entries_created, 'total_commission', v_subtotal_commission, 'type', 'GENERAL_SPLIT');
    END IF;

    -- 5b. Detailed Mode (Winner Quote Items)
    FOR v_item IN
        SELECT qi.id, qi.cantidad, qi.precio_unitario, qi.final_unit_price, qi.producto_id,
               lp.numero_articulo
        FROM "CRM_CotizacionItems" qi
        LEFT JOIN "CRM_ListaDePrecios" lp ON qi.producto_id = lp.id
        WHERE qi.cotizacion_id = v_winner_quote.id
    LOOP
        -- Resolve category
        v_category_id := NULL;
        IF v_item.numero_articulo IS NOT NULL THEN
            SELECT cc.id INTO v_category_id
            FROM "CRM_ComisionCategorias" cc
            WHERE cc.prefijo = LEFT(v_item.numero_articulo, 6)
              AND cc.is_active = TRUE;
        END IF;

        -- Resolve best rule
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
            
            -- Total commission for this item
            v_subtotal_commission := ROUND(v_item_amount * v_rule.porcentaje_comision / 100, 2);
            
            -- A. Owner Share
            v_owner_commission := ROUND(v_subtotal_commission * v_owner_percent / 100, 2);
            v_effective_owner_percent := ROUND(v_rule.porcentaje_comision * v_owner_percent / 100, 2);
            
            IF v_owner_commission > 0 THEN
               INSERT INTO "CRM_ComisionLedger" (
                    tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
                    base_amount, currency_id, porcentaje_comision, monto_comision,
                    regla_id, regla_snapshot,
                    categoria_id, categoria_snapshot,
                    created_by, notas
                ) VALUES (
                    'DEVENGADA', p_oportunidad_id, v_winner_quote.id,
                    v_opp.owner_user_id, v_opp.account_id, v_opp.canal_id,
                    v_item_amount, COALESCE(v_opp.currency_id, 'COP'), v_effective_owner_percent, v_owner_commission,
                    v_rule.rule_id, v_rule.rule_snapshot,
                    v_category_id,
                    CASE WHEN v_category_id IS NOT NULL THEN
                        (SELECT jsonb_build_object('id', cc.id, 'prefijo', cc.prefijo, 'nombre', cc.nombre)
                         FROM "CRM_ComisionCategorias" cc WHERE cc.id = v_category_id)
                    ELSE NULL END,
                    p_triggered_by,
                    'Participacion: ' || v_owner_percent || '% (Regla: ' || v_rule.porcentaje_comision || '%)'
                ); 
                v_entries_created := v_entries_created + 1;
            END IF;

             -- B. Collaborator Share (Loop for each item? Yes, proportional split applies to all items)
            FOR v_collab IN SELECT * FROM "CRM_Oportunidades_Colaboradores" WHERE oportunidad_id = p_oportunidad_id
            LOOP
                v_collab_commission := ROUND(v_subtotal_commission * v_collab.porcentaje / 100, 2);
                v_effective_collab_percent := ROUND(v_rule.porcentaje_comision * v_collab.porcentaje / 100, 2);

                IF v_collab_commission > 0 THEN
                    INSERT INTO "CRM_ComisionLedger" (
                        tipo_evento, oportunidad_id, cotizacion_id, vendedor_id, cuenta_id, canal_id,
                        base_amount, currency_id, porcentaje_comision, monto_comision,
                        regla_id, regla_snapshot,
                        categoria_id, categoria_snapshot,
                        created_by, notas
                    ) VALUES (
                        'DEVENGADA', p_oportunidad_id, v_winner_quote.id,
                        v_collab.usuario_id, v_opp.account_id, v_opp.canal_id,
                        v_item_amount, COALESCE(v_opp.currency_id, 'COP'), v_effective_collab_percent, v_collab_commission,
                        v_rule.rule_id, v_rule.rule_snapshot,
                        v_category_id,
                        CASE WHEN v_category_id IS NOT NULL THEN
                            (SELECT jsonb_build_object('id', cc.id, 'prefijo', cc.prefijo, 'nombre', cc.nombre)
                             FROM "CRM_ComisionCategorias" cc WHERE cc.id = v_category_id)
                        ELSE NULL END,
                        p_triggered_by,
                        'Participacion (Colaborador): ' || v_collab.porcentaje || '% (Regla: ' || v_rule.porcentaje_comision || '%)'
                    );
                    v_entries_created := v_entries_created + 1;
                END IF;
            END LOOP;

            v_total_commission_project := v_total_commission_project + v_subtotal_commission;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'entries', v_entries_created,
        'total_commission', v_total_commission_project,
        'quote_id', v_winner_quote.id,
        'type', 'DETAILED_SPLIT'
    );
END;
$$;
