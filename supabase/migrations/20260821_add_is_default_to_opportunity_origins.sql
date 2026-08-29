-- =============================================================================
-- MIGRATION: 20260821_add_is_default_to_opportunity_origins.sql
-- Agregar columna is_default a CRM_OrigenesOportunidad
-- =============================================================================

BEGIN;

ALTER TABLE "CRM_OrigenesOportunidad"
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Garantizar que solo un registro pueda tener is_default = true
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_origenes_is_default 
    ON "CRM_OrigenesOportunidad" (is_default) 
    WHERE is_default = TRUE;

-- Asignar por defecto el primer origen activo si ninguno lo tiene
UPDATE "CRM_OrigenesOportunidad"
SET is_default = TRUE
WHERE id = (
    SELECT id FROM "CRM_OrigenesOportunidad"
    WHERE is_active = TRUE
    ORDER BY orden ASC, nombre ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM "CRM_OrigenesOportunidad" WHERE is_default = TRUE
);

COMMIT;
