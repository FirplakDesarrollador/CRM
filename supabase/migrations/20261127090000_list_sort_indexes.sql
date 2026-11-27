-- Índices para el orden por defecto de los listados (paginación por rango + desempate por id).
-- Solo filas activas (is_deleted = false), que es lo que consultan las listas.
-- No cambian datos; solo aceleran ORDER BY ... LIMIT/OFFSET.
-- Para tablas grandes en producción, preferir ejecutar cada sentencia con CONCURRENTLY
-- fuera de una transacción: CREATE INDEX CONCURRENTLY IF NOT EXISTS ...

-- /oportunidades: ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_oportunidades_activas_created_at
    ON "CRM_Oportunidades" (created_at DESC, id DESC)
    WHERE is_deleted = false;

-- /cuentas: ORDER BY updated_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_cuentas_activas_updated_at
    ON "CRM_Cuentas" (updated_at DESC, id DESC)
    WHERE is_deleted = false;

-- /contactos: ORDER BY updated_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_contactos_activos_updated_at
    ON "CRM_Contactos" (updated_at DESC, id DESC)
    WHERE is_deleted = false;
