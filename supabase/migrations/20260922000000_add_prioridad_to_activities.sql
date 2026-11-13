-- Migration: Add prioridad column to CRM_Actividades
ALTER TABLE "CRM_Actividades"
  ADD COLUMN IF NOT EXISTS "prioridad" TEXT DEFAULT 'Media';
