-- Add tipo_actividad column to CRM_Actividades
-- Values: 'EVENTO' (default) or 'TAREA'

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'CRM_Actividades' 
        AND column_name = 'tipo_actividad'
    ) THEN
        ALTER TABLE "CRM_Actividades" 
        ADD COLUMN "tipo_actividad" TEXT DEFAULT 'EVENTO';
        
        -- Add check constraint to ensure valid values
        ALTER TABLE "CRM_Actividades" 
        ADD CONSTRAINT "check_tipo_actividad" 
        CHECK (tipo_actividad IN ('EVENTO', 'TAREA'));
    END IF;
END $$;
