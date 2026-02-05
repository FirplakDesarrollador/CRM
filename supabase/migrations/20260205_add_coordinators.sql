-- Add coordinadores column to CRM_Usuarios
ALTER TABLE "CRM_Usuarios" 
ADD COLUMN IF NOT EXISTS "coordinadores" uuid[] DEFAULT '{}';

-- Helper function to check if user is a coordinator of the record owner
-- This assumes standard 'created_by' field on tables
CREATE OR REPLACE FUNCTION is_coordinator_of_owner(record_owner_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "CRM_Usuarios"
    WHERE id = record_owner_id
    AND auth.uid() = ANY(coordinadores)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS Policies for Accounts (CRM_Cuentas)
DROP POLICY IF EXISTS "Coordinadores access accounts of assigned users" ON "CRM_Cuentas";
CREATE POLICY "Coordinadores access accounts of assigned users"
ON "CRM_Cuentas"
FOR SELECT
TO authenticated
USING (
  is_coordinator_of_owner(created_by)
);

-- Update RLS Policies for Opportunities (CRM_Oportunidades)
DROP POLICY IF EXISTS "Coordinadores access opportunities of assigned users" ON "CRM_Oportunidades";
CREATE POLICY "Coordinadores access opportunities of assigned users"
ON "CRM_Oportunidades"
FOR SELECT
TO authenticated
USING (
  is_coordinator_of_owner(created_by)
);

-- Update RLS Policies for Contacts (CRM_Contactos)
DROP POLICY IF EXISTS "Coordinadores access contacts of assigned users" ON "CRM_Contactos";
CREATE POLICY "Coordinadores access contacts of assigned users"
ON "CRM_Contactos"
FOR SELECT
TO authenticated
USING (
  is_coordinator_of_owner(created_by)
);

-- Update RLS Policies for Activities (CRM_Actividades)
DROP POLICY IF EXISTS "Coordinadores access activities of assigned users" ON "CRM_Actividades";
CREATE POLICY "Coordinadores access activities of assigned users"
ON "CRM_Actividades"
FOR SELECT
TO authenticated
USING (
  is_coordinator_of_owner(created_by)
);

-- Also allow coordinators to see the User details of users they coordinate
-- (So they can see the name in filters etc)
DROP POLICY IF EXISTS "Coordinadores see assigned users" ON "CRM_Usuarios";
CREATE POLICY "Coordinadores see assigned users"
ON "CRM_Usuarios"
FOR SELECT
TO authenticated
USING (
  auth.uid() = ANY(coordinadores)
);
