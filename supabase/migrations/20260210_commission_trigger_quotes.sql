-- =============================================================================
-- COMMISSION ENGINE: Auto-trigger DEVENGADA on Quote Winner
-- Fires when CRM_Cotizaciones is marked as WINNER (status or is_winner flag)
-- Checks if Opportunity is ALREADY Won. If so, triggers commission calculation.
-- This handles the race condition where Quote syncs AFTER Opportunity close.
-- Date: 2026-02-10
-- Depends on: 20260210_commission_rpcs.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_auto_devengada_on_quote_win()
RETURNS TRIGGER AS $$
DECLARE
    v_opp_status INT;
    v_result JSONB;
BEGIN
    -- Only fire when status changes to WINNER or is_winner becomes TRUE
    IF (NEW.status = 'WINNER' AND (OLD.status IS DISTINCT FROM 'WINNER')) OR
       (NEW.is_winner = TRUE AND (OLD.is_winner IS DISTINCT FROM TRUE)) THEN
        
        -- Check if Parent Opportunity is WON (estado_id = 2)
        SELECT estado_id INTO v_opp_status
        FROM "CRM_Oportunidades"
        WHERE id = NEW.opportunity_id;

        IF v_opp_status = 2 THEN
            -- Trigger calculation (Idempotency inside the RPC will handle duplicates or upgrades)
            SELECT calculate_devengada(NEW.opportunity_id, '00000000-0000-0000-0000-000000000000') INTO v_result;
            
            -- Optional: Log to Postgres console/logs
            RAISE NOTICE 'Auto-triggered Commission Calc from Quote Win: %', v_result;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to allow clean re-run
DROP TRIGGER IF EXISTS on_quote_winner_devengada ON "CRM_Cotizaciones";

CREATE TRIGGER on_quote_winner_devengada
    AFTER UPDATE ON "CRM_Cotizaciones"
    FOR EACH ROW
    EXECUTE FUNCTION trg_auto_devengada_on_quote_win();
