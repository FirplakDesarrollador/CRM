-- =============================================================================
-- MIGRATION: 20260821_backfill_account_origin_from_opportunities.sql
-- Propagar origen de oportunidad a cuentas históricas y crear trigger de sincronización
-- =============================================================================

BEGIN;

-- 1. Poblar origen_cuenta en CRM_Cuentas tomando el origen de su oportunidad más reciente
WITH latest_opp_origins AS (
    SELECT DISTINCT ON (account_id)
        account_id,
        origen_oportunidad
    FROM "CRM_Oportunidades"
    WHERE origen_oportunidad IS NOT NULL 
      AND TRIM(origen_oportunidad) != ''
      AND is_deleted = FALSE
    ORDER BY account_id, created_at DESC
)
UPDATE "CRM_Cuentas" c
SET 
    origen_cuenta = l.origen_oportunidad,
    updated_at = NOW()
FROM latest_opp_origins l
WHERE c.id = l.account_id
  AND (c.origen_cuenta IS NULL OR TRIM(c.origen_cuenta) = '');

-- 2. Trigger automático: Cuando se cree o actualice una oportunidad con origen,
-- si la cuenta no tiene origen, asignarle automáticamente el origen de la oportunidad.
CREATE OR REPLACE FUNCTION trg_sync_opportunity_origin_to_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.account_id IS NOT NULL AND NEW.origen_oportunidad IS NOT NULL AND TRIM(NEW.origen_oportunidad) != '' THEN
        UPDATE "CRM_Cuentas"
        SET 
            origen_cuenta = NEW.origen_oportunidad,
            updated_at = NOW()
        WHERE id = NEW.account_id
          AND (origen_cuenta IS NULL OR TRIM(origen_cuenta) = '');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_opportunity_origin_to_account ON "CRM_Oportunidades";
CREATE TRIGGER trg_sync_opportunity_origin_to_account
    AFTER INSERT OR UPDATE OF origen_oportunidad, account_id ON "CRM_Oportunidades"
    FOR EACH ROW
    EXECUTE FUNCTION trg_sync_opportunity_origin_to_account();

COMMIT;
