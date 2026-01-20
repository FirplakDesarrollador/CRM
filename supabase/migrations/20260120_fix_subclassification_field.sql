-- FIX: Ensure Subclassification Field and Trigger are correct
-- Description: Re-applies FK and Trigger logic to ensure consistency.

BEGIN;

-- 1. Ensure Column Exists (Idempotent)
ALTER TABLE "CRM_Cuentas" ADD COLUMN IF NOT EXISTS subclasificacion_id INT;

-- 2. Reset FK Constraint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crmcuentas_subclasificacion') THEN
        ALTER TABLE "CRM_Cuentas" DROP CONSTRAINT fk_crmcuentas_subclasificacion;
    END IF;
END $$;

ALTER TABLE "CRM_Cuentas" 
    ADD CONSTRAINT fk_crmcuentas_subclasificacion 
    FOREIGN KEY (subclasificacion_id) REFERENCES "CRM_Subclasificacion"(id);

-- 3. Update Audit Trigger with safer casting
CREATE OR REPLACE FUNCTION audit_account_changes() RETURNS TRIGGER AS $$
BEGIN
    -- Canal ID
    IF (OLD.canal_id IS DISTINCT FROM NEW.canal_id) THEN
        INSERT INTO "CRM_Audit_Cuentas" (account_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.id, 'canal_id', OLD.canal_id, NEW.canal_id, auth.uid());
    END IF;

    -- Subclassification
    IF (OLD.subclasificacion_id IS DISTINCT FROM NEW.subclasificacion_id) THEN
        INSERT INTO "CRM_Audit_Cuentas" (account_id, field_changed, old_value, new_value, changed_by)
        VALUES (
            NEW.id, 
            'subclasificacion_id', 
            COALESCE(OLD.subclasificacion_id::text, 'NULL'), 
            COALESCE(NEW.subclasificacion_id::text, 'NULL'), 
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Grant Permissions (Fix potential RLS/Permission issues for Authenticated users)
GRANT SELECT, INSERT, UPDATE, DELETE ON "CRM_Subclasificacion" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CRM_Subclasificacion" TO service_role;

COMMIT;
