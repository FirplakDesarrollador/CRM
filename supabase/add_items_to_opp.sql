-- Add items column to CRM_Oportunidades
-- Run this in Supabase SQL Editor

ALTER TABLE "CRM_Oportunidades" 
ADD COLUMN IF NOT EXISTS "items" JSONB DEFAULT '[]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN "CRM_Oportunidades"."items" IS 'Selected products for the opportunity, stored as JSON array of objects';
