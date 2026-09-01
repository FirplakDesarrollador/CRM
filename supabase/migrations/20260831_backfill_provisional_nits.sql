-- =============================================================================
-- MIGRATION: 20260831_backfill_provisional_nits.sql
-- Backfill de NITs alfanuméricos provisionales únicos para cuentas sin NIT
-- =============================================================================

BEGIN;

-- Asignar un NIT provisional único PROV-XXXXXXXX a todas las cuentas que no tengan NIT o tengan cadena vacía o 'Sin NIT'
UPDATE "CRM_Cuentas"
SET 
    nit_base = 'PROV-' || UPPER(SUBSTRING(MD5(id::text || COALESCE(created_at, NOW())::text || RANDOM()::text) FROM 1 FOR 8)),
    updated_at = NOW()
WHERE 
    nit_base IS NULL 
    OR TRIM(nit_base) = '' 
    OR nit_base = 'Sin NIT';

COMMIT;
