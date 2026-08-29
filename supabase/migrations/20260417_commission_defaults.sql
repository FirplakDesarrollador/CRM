-- Migration: Commission Configuration Defaults
-- Date: 2026-04-17
-- Description: Adds default commission percentages to CRM_Configuracion

INSERT INTO "CRM_Configuracion" ("key", "value", "description")
VALUES 
  ('commission_creator_default_pct', '5', 'Porcentaje de comisión por defecto para el creador de la oportunidad si no es el dueño'),
  ('commission_owner_default_pct', '95', 'Porcentaje de comisión por defecto para el dueño de la cuenta si no es el creador')
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description";
