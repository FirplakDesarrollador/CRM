-- Migration to add is_deleted to CRM_Actividades
-- Date: 2026-01-27

ALTER TABLE "CRM_Actividades" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "CRM_Cotizaciones" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "CRM_CotizacionItems" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT FALSE;

-- Update RLS policies to filter out deleted activities
-- Note: schema.sql uses "Permissive All" policy which currently allows all.
-- Usually, we would want to update it, but let's stick to the existing pattern for now
-- or refine it if needed. For now, adding the column is the priority.
