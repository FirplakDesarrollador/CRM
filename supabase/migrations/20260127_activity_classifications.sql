-- MIGRATION: ACTIVITY CLASSIFICATIONS
-- Description: Adds tables for multi-level activity classification and seeds initial data.

BEGIN;

-- 1. Create Classification Tables

-- Table: CRM_Activity_Clasificacion
CREATE TABLE IF NOT EXISTS "CRM_Activity_Clasificacion" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_actividad VARCHAR(50) NOT NULL CHECK (tipo_actividad IN ('EVENTO', 'TAREA')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint to avoid duplicates per type
    UNIQUE(nombre, tipo_actividad)
);

-- Table: CRM_Activity_Subclasificacion
CREATE TABLE IF NOT EXISTS "CRM_Activity_Subclasificacion" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    clasificacion_id INT NOT NULL REFERENCES "CRM_Activity_Clasificacion"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint to avoid duplicates per classification
    UNIQUE(nombre, clasificacion_id)
);

-- 2. Modify CRM_Actividades to include references

-- Add columns if they don't exist
ALTER TABLE "CRM_Actividades" 
ADD COLUMN IF NOT EXISTS clasificacion_id INT,
ADD COLUMN IF NOT EXISTS subclasificacion_id INT;

-- Add Foreign Keys
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_activity_clasificacion') THEN
        ALTER TABLE "CRM_Actividades" DROP CONSTRAINT fk_activity_clasificacion;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_activity_subclasificacion') THEN
        ALTER TABLE "CRM_Actividades" DROP CONSTRAINT fk_activity_subclasificacion;
    END IF;
END $$;

ALTER TABLE "CRM_Actividades" 
ADD CONSTRAINT fk_activity_clasificacion 
FOREIGN KEY (clasificacion_id) REFERENCES "CRM_Activity_Clasificacion"(id);

ALTER TABLE "CRM_Actividades" 
ADD CONSTRAINT fk_activity_subclasificacion 
FOREIGN KEY (subclasificacion_id) REFERENCES "CRM_Activity_Subclasificacion"(id);

-- 3. RLS Policies (Enable access for authenticated users)

ALTER TABLE "CRM_Activity_Clasificacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Activity_Subclasificacion" ENABLE ROW LEVEL SECURITY;

-- Policy for CRM_Activity_Clasificacion
DO $$ BEGIN
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "CRM_Activity_Clasificacion";
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "CRM_Activity_Clasificacion";
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON "CRM_Activity_Clasificacion";
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "CRM_Activity_Clasificacion";
END $$;

CREATE POLICY "Enable read access for authenticated users" ON "CRM_Activity_Clasificacion"
    FOR SELECT TO authenticated USING (true);
    
CREATE POLICY "Enable insert for authenticated users" ON "CRM_Activity_Clasificacion"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "CRM_Activity_Clasificacion"
    FOR UPDATE TO authenticated USING (true);

-- Policy for CRM_Activity_Subclasificacion
DO $$ BEGIN
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "CRM_Activity_Subclasificacion";
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "CRM_Activity_Subclasificacion";
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON "CRM_Activity_Subclasificacion";
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "CRM_Activity_Subclasificacion";
END $$;

CREATE POLICY "Enable read access for authenticated users" ON "CRM_Activity_Subclasificacion"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "CRM_Activity_Subclasificacion"
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "CRM_Activity_Subclasificacion"
    FOR UPDATE TO authenticated USING (true);


-- 4. Seed Data

-- Helper function to seed classification and subclassifications
CREATE OR REPLACE FUNCTION seed_activity_cls(
    p_tipo TEXT, 
    p_nombre TEXT, 
    p_subs TEXT[] DEFAULT ARRAY[]::TEXT[]
) RETURNS VOID AS $$
DECLARE
    v_cls_id INT;
    v_sub TEXT;
BEGIN
    -- Insert Classification
    INSERT INTO "CRM_Activity_Clasificacion" (tipo_actividad, nombre)
    VALUES (p_tipo, p_nombre)
    ON CONFLICT (nombre, tipo_actividad) DO UPDATE SET nombre = EXCLUDED.nombre
    RETURNING id INTO v_cls_id;

    -- Insert Subclassifications
    FOREACH v_sub IN ARRAY p_subs
    LOOP
        INSERT INTO "CRM_Activity_Subclasificacion" (clasificacion_id, nombre)
        VALUES (v_cls_id, v_sub)
        ON CONFLICT (nombre, clasificacion_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- SEED: EVENTOS
SELECT seed_activity_cls('EVENTO', 'Capacitación');
SELECT seed_activity_cls('EVENTO', 'Reunión', ARRAY['Conversación efectiva de exhibición', 'Especificación carpintería de obra']);
SELECT seed_activity_cls('EVENTO', 'Apoyo comercial');
SELECT seed_activity_cls('EVENTO', 'Llamada telefónica', ARRAY['Conversación efectiva de exhibición', 'Especificación carpintería de obra']);
SELECT seed_activity_cls('EVENTO', 'Visita', ARRAY['Visita cliente premium Oro', 'Visita cliente premium Plata', 'Visita cliente premium Bronce', 'Viaita carpintería de obra', 'Especificación carpintería de obra']);
SELECT seed_activity_cls('EVENTO', 'Desayuno / Almuerzo de trabajo', ARRAY['Conversación efectiva de exhibición', 'Especificación carpintería de obra']);

-- SEED: TAREAS
SELECT seed_activity_cls('TAREA', 'Cobro de cartera');
SELECT seed_activity_cls('TAREA', 'Cotización');
SELECT seed_activity_cls('TAREA', 'Envío de documentos');
SELECT seed_activity_cls('TAREA', 'Programación de servicio');
SELECT seed_activity_cls('TAREA', 'Propuesta comercial');

-- Cleanup helper function
DROP FUNCTION seed_activity_cls;

COMMIT;
