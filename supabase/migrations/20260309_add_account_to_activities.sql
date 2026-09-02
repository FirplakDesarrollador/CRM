-- Migration: Add account_id to CRM_Actividades
-- This allows activities to be linked directly to an account,
-- independently or in conjunction with an opportunity.

ALTER TABLE "CRM_Actividades"
  ADD COLUMN IF NOT EXISTS "account_id" UUID REFERENCES "CRM_Cuentas"("id") ON DELETE SET NULL;
