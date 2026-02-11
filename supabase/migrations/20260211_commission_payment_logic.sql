-- Migration: Commission Payment Logic & Bonus Triggers
-- Date: 2026-02-11
-- Depends on: 20260210_commission_schema.sql

-- 0. Update Ledger to support Bonus Rule References
ALTER TABLE "CRM_ComisionLedger" 
ADD COLUMN IF NOT EXISTS regla_bono_id UUID REFERENCES "CRM_ReglasBono"(id);

-- 1. Helper: Check Bonus Eligibility
CREATE OR REPLACE FUNCTION check_bonus_eligibility(
    p_seller_id UUID,
    p_payment_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_total_collected NUMERIC(15, 2);
    v_bonus_rule RECORD;
    v_bonuses_awarded INT := 0;
BEGIN
    -- Determine Period (Month)
    v_start_date := DATE_TRUNC('month', p_payment_date);
    v_end_date := (DATE_TRUNC('month', p_payment_date) + INTERVAL '1 month - 1 day')::DATE;

    -- Calculate Total Collected by Seller in this Period
    -- defined as: Sum of Payments in CRM_Pagos where Opportunity Owner = Seller
    SELECT COALESCE(SUM(p.monto), 0)
    INTO v_total_collected
    FROM "CRM_Pagos" p
    JOIN "CRM_Oportunidades" o ON p.oportunidad_id = o.id
    WHERE o.owner_user_id = p_seller_id
      AND p.fecha_pago >= v_start_date 
      AND p.fecha_pago <= v_end_date;

    -- Iterate Active Monthly Bonus Rules
    FOR v_bonus_rule IN
        SELECT * FROM "CRM_ReglasBono"
        WHERE (vendedor_id IS NULL OR vendedor_id = p_seller_id)
          AND periodo = 'MENSUAL'
          AND is_active = TRUE
          -- Rule applies if Total >= Meta
          AND meta_recaudo <= v_total_collected
    LOOP
        -- Check if this specific bonus rule has already been awarded for this period
        -- We check existing LEDGER entries for type 'BONO' linked to this rule
        -- created within the same month.
        IF NOT EXISTS (
            SELECT 1 FROM "CRM_ComisionLedger"
            WHERE vendedor_id = p_seller_id
              AND tipo_evento = 'BONO'
              AND regla_bono_id = v_bonus_rule.id
              AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_payment_date)
        ) THEN
            -- Award Bonus
            INSERT INTO "CRM_ComisionLedger" (
                tipo_evento, vendedor_id, base_amount, monto_comision,
                regla_bono_id, motivo, status, created_by,
                currency_id, porcentaje_comision
            ) VALUES (
                'BONO', p_seller_id, v_total_collected, v_bonus_rule.monto_bono,
                v_bonus_rule.id, 
                'Bono Mensual por Recaudo (' || TO_CHAR(v_total_collected, 'FM999,999,999') || ' / Meta ' || TO_CHAR(v_bonus_rule.meta_recaudo, 'FM999,999,999') || ')',
                'EARNED', auth.uid(),
                v_bonus_rule.currency_id, 0
            );
            v_bonuses_awarded := v_bonuses_awarded + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'period_start', v_start_date,
        'total_collected', v_total_collected, 
        'bonuses_awarded', v_bonuses_awarded
    );
END;
$$;

-- 2. Facade: Register Payment -> Trigger Logic
CREATE OR REPLACE FUNCTION register_payment(
    p_oportunidad_id UUID,
    p_monto NUMERIC(15, 2),
    p_sap_doc_entry VARCHAR(100),
    p_fecha_pago DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_opp RECORD;
    v_payment_id UUID;
    v_bonus_result JSONB;
    v_pagada_result JSONB;
BEGIN
    SELECT * INTO v_opp FROM "CRM_Oportunidades" WHERE id = p_oportunidad_id;
    IF v_opp IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Oportunidad no encontrada');
    END IF;

    -- 1. Insert Payment
    INSERT INTO "CRM_Pagos" (oportunidad_id, monto, fecha_pago, sap_doc_entry, created_by)
    VALUES (p_oportunidad_id, p_monto, p_fecha_pago, p_sap_doc_entry, auth.uid())
    RETURNING id INTO v_payment_id;

    -- 2. Check Bonuses (Async ideally, but sync for now)
    SELECT check_bonus_eligibility(v_opp.owner_user_id, p_fecha_pago) INTO v_bonus_result;

    -- 3. Mark Commission as Paid (Legacy/Transactional)
    -- We attempt to call the existing function. If it returns error (e.g. already paid), we ignore it safely?
    -- No, if it returns error "Already Paid", that's fine, we just successfully registered the NEW payment layer.
    -- But if it's the FIRST payment, we want to mark it.
    -- We'll store the result but return success for register_payment regardless.
    
    BEGIN
        SELECT record_commission_pagada(p_oportunidad_id, p_sap_doc_entry, auth.uid()) INTO v_pagada_result;
    EXCEPTION WHEN OTHERS THEN
        v_pagada_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;

    RETURN jsonb_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'bonus_check', v_bonus_result,
        'transactional_update', v_pagada_result
    );
END;
$$;
