-- Remediation: Force Recalculation for Constructora Beta SA
-- Date: 2026-02-11
-- Description:
-- 1. Finds the opportunity ID for 'Constructora Beta SA'.
-- 2. Deletes the existing (incorrect 0% or to-owner-100%) commission from CRM_ComisionLedger.
-- 3. Calls calculate_devengada again to apply the new split logic.

DO $$
DECLARE
    v_opp_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Find the Opportunity ID (Assuming 'Constructora Beta' in Account Name)
    SELECT o.id INTO v_opp_id
    FROM "CRM_Oportunidades" o
    JOIN "CRM_Cuentas" c ON o.account_id = c.id
    WHERE c.nombre ILIKE '%Constructora Beta%'
    LIMIT 1;

    IF v_opp_id IS NULL THEN
        RAISE NOTICE 'No opportunity found for Constructora Beta.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found Opportunity ID: %', v_opp_id;

    -- 2. Delete existing DEVENGADA (Use with caution in Prod!)
    -- We assume the existing ones are incorrect/incomplete.
    DELETE FROM "CRM_ComisionLedger"
    WHERE oportunidad_id = v_opp_id
      AND tipo_evento = 'DEVENGADA';

    RAISE NOTICE 'Deleted existing commission entries for %', v_opp_id;

    -- 3. Force Recalculation
    -- Uses the current user (auth.uid()) or a system user
    v_result := calculate_devengada(v_opp_id, auth.uid());
    
    RAISE NOTICE 'Recalculation Result: %', v_result;

END $$;
