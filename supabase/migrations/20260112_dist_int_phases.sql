-- MIGRATION: UPDATE PHASES FOR DIST_INT (Distribución Internacional)
-- Description: Replaces existing phases with: Visita, Presentación de propuesta, Acuerdo de precios, Envío de proforma, Cerrada ganada, Cerrada Perdida.

BEGIN;

-- 1. Create the new first phase temporarily to move existing opportunities
-- We use a name that won't conflict or we just insert it first
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id)
VALUES ('Visita', 1, true, 'DIST_INT');

-- 2. Migrate all existing opportunities in DIST_INT to the new 'Visita' phase
-- This avoids FK violations when we delete the old phases
UPDATE "CRM_Oportunidades" AS opp
SET fase_id = (SELECT id FROM "CRM_FasesOportunidad" WHERE nombre = 'Visita' AND canal_id = 'DIST_INT' LIMIT 1)
FROM "CRM_Cuentas" AS acc
WHERE opp.account_id = acc.id
  AND acc.canal_id = 'DIST_INT'
  AND opp.fase_id IN (
      SELECT id FROM "CRM_FasesOportunidad" 
      WHERE canal_id = 'DIST_INT' 
      AND nombre != 'Visita' -- Don't migrate from the one we just created
  );

-- 3. Delete old phases for DIST_INT
-- Careful: only delete those that ARE NOT the new 'Visita' phase we just created
DELETE FROM "CRM_FasesOportunidad"
WHERE canal_id = 'DIST_INT'
  AND nombre != 'Visita';

-- 4. Insert the remaining new phases
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id) VALUES
    ('Presentación de propuesta', 2, true, 'DIST_INT'),
    ('Acuerdo de precios', 3, true, 'DIST_INT'),
    ('Envío de proforma', 4, true, 'DIST_INT'),
    ('Cerrada ganada', 5, true, 'DIST_INT'),
    ('Cerrada Perdida', 6, true, 'DIST_INT')
ON CONFLICT DO NOTHING;

COMMIT;
