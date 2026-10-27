-- 20261027100000_add_setter_cliente_frecuente_activity_classifications.sql
-- Clasificaciones de actividad exclusivas del equipo B2C (Canal Propio):
--   * "SETTER"
--   * "Cliente frecuente"
-- Se crean para ambos tipos de actividad (EVENTO y TAREA). Idempotente: no duplica si ya existen
-- (UNIQUE(nombre, tipo_actividad)) y reactiva una fila previamente marcada como eliminada.
-- La app oculta estas clasificaciones a usuarios que no pertenecen al canal PROPIO (salvo ADMIN).

BEGIN;

-- Algunas filas del catálogo se insertaron con id explícito: alinear la secuencia para evitar colisiones.
SELECT setval(
    pg_get_serial_sequence('public."CRM_Activity_Clasificacion"', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public."CRM_Activity_Clasificacion"), 1)
);

INSERT INTO public."CRM_Activity_Clasificacion" (nombre, tipo_actividad, is_deleted)
SELECT v.nombre, v.tipo_actividad, FALSE
FROM (VALUES
    ('SETTER', 'EVENTO'),
    ('SETTER', 'TAREA'),
    ('Cliente frecuente', 'EVENTO'),
    ('Cliente frecuente', 'TAREA')
) AS v(nombre, tipo_actividad)
ON CONFLICT (nombre, tipo_actividad) DO UPDATE SET is_deleted = FALSE;

COMMIT;
