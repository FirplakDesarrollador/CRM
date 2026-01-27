-- MIGRATION: Opportunity Segments
-- Description: Adds hierarchical Segments linked to Subclassifications for Opportunities.

BEGIN;

-- 1. Create CRM_Segmentos Table
CREATE TABLE IF NOT EXISTS "CRM_Segmentos" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    subclasificacion_id INT NOT NULL REFERENCES "CRM_Subclasificacion"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nombre, subclasificacion_id)
);

-- 2. Populate Segments
-- We need to find the IDs of the subclassifications to insert correctly.
-- Using DO block to dynamically lookup IDs based on names + channel context.

DO $$
DECLARE
    -- Channels (for context, though subclasificacion name should be unique enough per channel, we'll be safe)
    v_canal_obras_nac VARCHAR := 'OBRAS_NAC';
    
    -- Subclassifications IDs
    v_sub_residencial INT;
    v_sub_reforma_nueva INT;
    
BEGIN
    -- Get Subclassification IDs (assuming they exist from previous migration)
    SELECT id INTO v_sub_residencial FROM "CRM_Subclasificacion" 
    WHERE nombre = 'Obras residenciales' AND canal_id = v_canal_obras_nac;

    SELECT id INTO v_sub_reforma_nueva FROM "CRM_Subclasificacion" 
    WHERE nombre = 'Reforma de vivienda nueva' AND canal_id = v_canal_obras_nac;

    -- Insert Segments for 'Obras residenciales'
    IF v_sub_residencial IS NOT NULL THEN
        INSERT INTO "CRM_Segmentos" (nombre, subclasificacion_id) VALUES
            ('Obras estrato alto', v_sub_residencial),
            ('Obras estrato medio', v_sub_residencial),
            ('Obras VIS/VIP', v_sub_residencial),
            ('Hotelería', v_sub_residencial)
        ON CONFLICT (nombre, subclasificacion_id) DO NOTHING;
    END IF;

    -- Insert Segments for 'Reforma de vivienda nueva'
    IF v_sub_reforma_nueva IS NOT NULL THEN
        INSERT INTO "CRM_Segmentos" (nombre, subclasificacion_id) VALUES
            ('Reforma de vivienda', v_sub_reforma_nueva),
            ('Reforma VIS/VIP', v_sub_reforma_nueva)
        ON CONFLICT (nombre, subclasificacion_id) DO NOTHING;
    END IF;

END $$;

-- 3. Modify CRM_Oportunidades
ALTER TABLE "CRM_Oportunidades" 
    ADD COLUMN IF NOT EXISTS segmento_id INT;

-- Reset FK if exists (safety)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crmoportunidades_segmento') THEN
        ALTER TABLE "CRM_Oportunidades" DROP CONSTRAINT fk_crmoportunidades_segmento;
    END IF;
END $$;

ALTER TABLE "CRM_Oportunidades" 
    ADD CONSTRAINT fk_crmoportunidades_segmento 
    FOREIGN KEY (segmento_id) REFERENCES "CRM_Segmentos"(id);

-- 3.1 Modify CRM_Cotizaciones (Missed in original plan, added for fix)
ALTER TABLE "CRM_Cotizaciones" 
    ADD COLUMN IF NOT EXISTS segmento_id INT;

-- Reset FK for Cotizaciones if exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crmcotizaciones_segmento') THEN
        ALTER TABLE "CRM_Cotizaciones" DROP CONSTRAINT fk_crmcotizaciones_segmento;
    END IF;
END $$;

ALTER TABLE "CRM_Cotizaciones" 
    ADD CONSTRAINT fk_crmcotizaciones_segmento 
    FOREIGN KEY (segmento_id) REFERENCES "CRM_Segmentos"(id);

-- 4. Update Audit Trigger for Opportunities
-- Use COALESCE to handle NULLs safely (Lesson Learned)

CREATE OR REPLACE FUNCTION audit_opportunity_changes() RETURNS TRIGGER AS $$
BEGIN
    -- Standard fields audit (simplified for brevity, ensuring existing ones are safe)
    
    -- Segment Audit
    IF (OLD.segmento_id IS DISTINCT FROM NEW.segmento_id) THEN
        INSERT INTO "CRM_Audit_Oportunidades" (opportunity_id, field_changed, old_value, new_value, changed_by)
        VALUES (
            NEW.id, 
            'segmento_id', 
            COALESCE(OLD.segmento_id::text, 'NULL'), 
            COALESCE(NEW.segmento_id::text, 'NULL'), 
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure Trigger Exists
DROP TRIGGER IF EXISTS trg_audit_opportunity_changes ON "CRM_Oportunidades";
CREATE TRIGGER trg_audit_opportunity_changes
AFTER UPDATE ON "CRM_Oportunidades"
FOR EACH ROW EXECUTE FUNCTION audit_opportunity_changes();

-- 5. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON "CRM_Segmentos" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CRM_Segmentos" TO service_role;

COMMIT;
