-- Agregar columnas paises y departamentos (arreglos de texto para seleccion multiple) a CRM_Usuarios
ALTER TABLE "CRM_Usuarios" 
  ADD COLUMN IF NOT EXISTS "paises" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "departamentos" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "pais" TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS "departamento" TEXT;

COMMENT ON COLUMN "CRM_Usuarios"."paises" IS 'Lista de IDs de países asignados al vendedor/usuario (selección múltiple)';
COMMENT ON COLUMN "CRM_Usuarios"."departamentos" IS 'Lista de IDs de departamentos asignados al vendedor/usuario (selección múltiple)';
