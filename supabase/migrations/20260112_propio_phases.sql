-- MIGRATION: UPDATE PHASES FOR PROPIO (Canal Propio - B2C)
-- Description: Replaces existing phases with: Primer contacto, Presentación de propuesta, Acuerdo de precios, Negociación final, Esperando pedido, Cerrada ganada, Cerrada Perdida.

BEGIN;

-- 1. Create the new first phase 'Primer contacto'
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id)
VALUES ('Primer contacto', 1, true, 'PROPIO');

-- 2. Migrate existing opportunities to 'Primer contacto'
UPDATE "CRM_Oportunidades" AS opp
SET fase_id = (SELECT id FROM "CRM_FasesOportunidad" WHERE nombre = 'Primer contacto' AND canal_id = 'PROPIO' LIMIT 1)
FROM "CRM_Cuentas" AS acc
WHERE opp.account_id = acc.id
  AND acc.canal_id = 'PROPIO'
  AND opp.fase_id IN (
      SELECT id FROM "CRM_FasesOportunidad" 
      WHERE canal_id = 'PROPIO' 
      AND nombre != 'Primer contacto'
  );

-- 3. Delete old phases for PROPIO
DELETE FROM "CRM_FasesOportunidad"
WHERE canal_id = 'PROPIO'
  AND nombre != 'Primer contacto';

-- 4. Insert the remaining new phases
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id) VALUES
    ('Presentación de propuesta', 2, true, 'PROPIO'),
    ('Acuerdo de precios', 3, true, 'PROPIO'),
    ('Negociación final', 4, true, 'PROPIO'),
    ('Esperando pedido', 5, true, 'PROPIO'),
    ('Cerrada ganada', 6, true, 'PROPIO'),
    ('Cerrada Perdida', 7, true, 'PROPIO')
ON CONFLICT DO NOTHING;

COMMIT;
