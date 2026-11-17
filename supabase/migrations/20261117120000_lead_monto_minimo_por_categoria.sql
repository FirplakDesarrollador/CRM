-- Migration: Monto mínimo por categoría para leads / prospectos (B2C)
-- Date: 2026-11-17
-- Planner: "Funcionalidades CRM B2C_2" — "al ingresar los lead prospecto vengan
--          con monto mínimo por categoría. /FIRPLAK"
--
-- NO APLICADA EN PRODUCCIÓN. Solo agrega una fila de configuración (sin DDL).
-- Mientras los montos estén en null, nada cambia: los leads entran con amount = 0
-- como hoy. Para activarlo, poner los montos (COP) en "montos".
--   modo = "maximo": si el lead trae varias categorías, se usa el mayor mínimo.
--   modo = "suma":   se suman los mínimos de todas las categorías.
--
-- Lo usan:
--   * supabase/functions/wordpress-lead-intake (leads de la web)  -> requiere redeploy
--   * app/oportunidades/nueva (creación manual de oportunidades B2C sin valor)
--
-- ROLLBACK:
--   DELETE FROM "CRM_Configuracion" WHERE "key" = 'lead_monto_minimo_por_categoria';
--   (Las oportunidades ya creadas conservan el monto que recibieron.)

INSERT INTO "CRM_Configuracion" ("key", "value", "description")
VALUES (
  'lead_monto_minimo_por_categoria',
  '{
    "modo": "maximo",
    "montos": {
      "Baños": null,
      "Cocinas": null,
      "Zona de Labores": null,
      "Hidromasajes": null,
      "Carpintería de obras": null,
      "Institucional": null,
      "Accesorios": null,
      "Deseo contactar un asesor": null
    }
  }'::jsonb,
  'Monto mínimo (COP) con el que entra un lead/prospecto B2C según su categoría de interés'
)
ON CONFLICT ("key") DO NOTHING;
