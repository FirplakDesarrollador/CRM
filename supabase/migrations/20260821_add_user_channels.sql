-- Agregar columna canales (arreglo de texto para seleccion multiple) a CRM_Usuarios
ALTER TABLE "CRM_Usuarios" 
  ADD COLUMN IF NOT EXISTS "canales" TEXT[] DEFAULT '{}';

COMMENT ON COLUMN "CRM_Usuarios"."canales" IS 'Lista de IDs de canales de venta asignados al vendedor/usuario (ej. PROPIO, DIST_NAC, DIST_INT, OBRAS_NAC, OBRAS_INT, FERIA)';
