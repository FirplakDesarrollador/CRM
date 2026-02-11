-- =============================================================================
-- COMMISSION ENGINE: Auto-trigger DEVENGADA on Won
-- Fires when CRM_Oportunidades.estado_id changes to 2 (Ganada)
-- Date: 2026-02-10
-- Depends on: 20260210_commission_rpcs.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_auto_devengada()
RETURNS TRIGGER AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Only fire when estado_id changes TO 2 (Ganada)
    IF NEW.estado_id = 2 AND (OLD.estado_id IS DISTINCT FROM 2) THEN
        v_result := calculate_devengada(NEW.id, COALESCE(NEW.updated_by, auth.uid()));
        RAISE NOTICE 'Commission DEVENGADA for opp %: %', NEW.id, v_result;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_opp_devengada ON "CRM_Oportunidades";
CREATE TRIGGER trg_opp_devengada
AFTER UPDATE OF estado_id ON "CRM_Oportunidades"
FOR EACH ROW EXECUTE FUNCTION trg_auto_devengada();
