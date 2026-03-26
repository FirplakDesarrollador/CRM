-- Migration: Fix RLS for Cities and Departments
-- Description: Enables RLS and adds public read access policies for the new catalog tables.

-- 1. Enable RLS
ALTER TABLE "CRM_Departamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Ciudades" ENABLE ROW LEVEL SECURITY;

-- 2. Add Read Policies for Authenticated Users (Minimum requirement)
-- Since these are public catalogs, we allow all authenticated users to read them.

DROP POLICY IF EXISTS "Public read access for departamentos" ON "CRM_Departamentos";
CREATE POLICY "Public read access for departamentos" 
ON "CRM_Departamentos" FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Public read access for ciudades" ON "CRM_Ciudades";
CREATE POLICY "Public read access for ciudades" 
ON "CRM_Ciudades" FOR SELECT 
TO authenticated 
USING (true);

-- 3. Verify Realtime (Optional, but good for sync)
-- If we want these to push updates via Realtime
-- ALTER PUBLICATION supabase_realtime ADD TABLE "CRM_Departamentos";
-- ALTER PUBLICATION supabase_realtime ADD TABLE "CRM_Ciudades";
