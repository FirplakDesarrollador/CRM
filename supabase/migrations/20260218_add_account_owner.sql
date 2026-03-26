-- Add owner_user_id column to CRM_Cuentas
ALTER TABLE "CRM_Cuentas"
ADD COLUMN IF NOT EXISTS "owner_user_id" UUID REFERENCES auth.users(id);

-- 1. Try to set owner from the most recent opportunity associated with the account
UPDATE "CRM_Cuentas" c
SET "owner_user_id" = COALESCE(
    (
        SELECT o.owner_user_id
        FROM "CRM_Oportunidades" o
        WHERE o.account_id = c.id
        ORDER BY o.created_at DESC -- Most recent opportunity determines owner
        LIMIT 1
    ),
    c.created_by -- Fallback immediately if no opportunity found
);

-- Note: The above query handles both cases in one pass.
-- If subquery returns NULL (no opportunities), COALESCE takes c.created_by.

-- Just in case any are still null (e.g. no opportunity AND created_by is null), maybe try auth.uid() or leave null?
-- Let's leave them null or set to a system user if needed, but created_by should usually be present.

-- Function to set default owner
CREATE OR REPLACE FUNCTION set_account_owner_default()
RETURNS TRIGGER AS $$
BEGIN
    -- If owner_user_id is not provided, use created_by
    IF NEW.owner_user_id IS NULL THEN
        NEW.owner_user_id := NEW.created_by;
    END IF;
    -- If still null (e.g. created_by wasn't set?), try auth.uid()
    IF NEW.owner_user_id IS NULL THEN
        NEW.owner_user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set default owner on insert
DROP TRIGGER IF EXISTS trg_set_account_owner ON "CRM_Cuentas";
CREATE TRIGGER trg_set_account_owner
BEFORE INSERT ON "CRM_Cuentas"
FOR EACH ROW
EXECUTE FUNCTION set_account_owner_default();

-- Update indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_cuentas_owner ON "CRM_Cuentas"(owner_user_id);
