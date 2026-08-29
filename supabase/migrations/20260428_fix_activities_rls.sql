-- Migration: Fix RLS policies for Activities, Contacts, Quotes and Opportunities
-- Ensure owners can see their own records

-- 1. CRM_Actividades
DROP POLICY IF EXISTS "Owners can see their own activities" ON "CRM_Actividades";
CREATE POLICY "Owners can see their own activities"
ON "CRM_Actividades"
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
);

-- 2. CRM_Oportunidades
DROP POLICY IF EXISTS "Owners can see their own opportunities" ON "CRM_Oportunidades";
CREATE POLICY "Owners can see their own opportunities"
ON "CRM_Oportunidades"
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_user_id
);

-- 3. CRM_Contactos
DROP POLICY IF EXISTS "Owners can see their own contacts" ON "CRM_Contactos";
CREATE POLICY "Owners can see their own contacts"
ON "CRM_Contactos"
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
);

-- 4. CRM_Cotizaciones
DROP POLICY IF EXISTS "Owners can see their own quotes" ON "CRM_Cotizaciones";
CREATE POLICY "Owners can see their own quotes"
ON "CRM_Cotizaciones"
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
);

-- Force refresh
NOTIFY pgrst, 'reload config';
