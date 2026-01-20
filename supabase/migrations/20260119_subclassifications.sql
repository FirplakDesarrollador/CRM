-- MIGRATION: ACCOUNT SUBCLASSIFICATIONS
-- Description: Adds CRM_Subclasificacion table and links it to CRM_Cuentas.

BEGIN;

-- 1. Create Lookup Table
CREATE TABLE IF NOT EXISTS "CRM_Subclasificacion" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    canal_id VARCHAR(20) NOT NULL REFERENCES "CRM_Canales"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint to avoid duplicates per channel
    UNIQUE(nombre, canal_id)
);

-- 2. Insert Initial Data
-- OBRAS_INT
INSERT INTO "CRM_Subclasificacion" (nombre, canal_id) VALUES 
    ('Obras Exterior', 'OBRAS_INT')
ON CONFLICT DO NOTHING;

-- OBRAS_NAC
INSERT INTO "CRM_Subclasificacion" (nombre, canal_id) VALUES 
    ('Obras residenciales', 'OBRAS_NAC'),
    ('Reforma de vivienda nueva', 'OBRAS_NAC')
ON CONFLICT DO NOTHING;

-- DIST_INT
INSERT INTO "CRM_Subclasificacion" (nombre, canal_id) VALUES 
    ('Distribuidor Premium Internacional', 'DIST_INT'),
    ('Distribuidor Internacional', 'DIST_INT')
ON CONFLICT DO NOTHING;

-- DIST_NAC
INSERT INTO "CRM_Subclasificacion" (nombre, canal_id) VALUES 
    ('Cliente activo', 'DIST_NAC'),
    ('Cliente destacado', 'DIST_NAC'),
    ('Cliente premium', 'DIST_NAC')
ON CONFLICT DO NOTHING;


-- 3. Modify CRM_Cuentas
ALTER TABLE "CRM_Cuentas" 
    ADD COLUMN IF NOT EXISTS subclasificacion_id INT;

-- Add FK
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crmcuentas_subclasificacion') THEN
        ALTER TABLE "CRM_Cuentas" DROP CONSTRAINT fk_crmcuentas_subclasificacion;
    END IF;
END $$;

ALTER TABLE "CRM_Cuentas" 
    ADD CONSTRAINT fk_crmcuentas_subclasificacion 
    FOREIGN KEY (subclasificacion_id) REFERENCES "CRM_Subclasificacion"(id);


-- 4. Audit Trail Update (Optional - using existing flexible audit or specific trigger)
-- If audit_account_changes trigger uses explicit column mapping, we should update it.
-- Checking existing implementation... iterating over changed columns would be better but simple specific check is safer.

CREATE OR REPLACE FUNCTION audit_account_changes() RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.canal_id IS DISTINCT FROM NEW.canal_id) THEN
        INSERT INTO "CRM_Audit_Cuentas" (account_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.id, 'canal_id', OLD.canal_id, NEW.canal_id, auth.uid());
    END IF;

    IF (OLD.subclasificacion_id IS DISTINCT FROM NEW.subclasificacion_id) THEN
        INSERT INTO "CRM_Audit_Cuentas" (account_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.id, 'subclasificacion_id', OLD.subclasificacion_id::text, NEW.subclasificacion_id::text, auth.uid());
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
