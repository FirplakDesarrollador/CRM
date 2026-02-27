-- Habilitar RLS y agregar política permisiva para CRM_FasesOportunidad
-- Esto permite que la aplicación lea las fases de oportunidad

-- Habilitar RLS en la tabla
ALTER TABLE "CRM_FasesOportunidad" ENABLE ROW LEVEL SECURITY;

-- Crear política permisiva para lectura (SELECT)
-- Las fases son datos de catálogo que todos los usuarios autenticados deben poder leer
CREATE POLICY "Allow authenticated users to read phases" 
ON "CRM_FasesOportunidad"
FOR SELECT
TO authenticated
USING (true);

-- Verificar que la política se creó correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'CRM_FasesOportunidad';
