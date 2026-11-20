-- MIGRATION: Map PROPIO channel to pvp_sin_iva
-- Description: Evita doble cobro de IVA en B2C actualizando el mapeo de columna de precio en CRM_Canales.

UPDATE "CRM_Canales"
SET columna_precio = 'pvp_sin_iva'
WHERE id = 'PROPIO';

