-- Add allowed_modules column to CRM_Usuarios
-- This array will store the keys/paths of modules the user is allowed to access
-- If NULL, the system may fall back to default role-based permissions

ALTER TABLE "CRM_Usuarios" ADD COLUMN IF NOT EXISTS "allowed_modules" TEXT[];

-- Update RLS if necessary (though typical RLS is on rows, not columns)
-- Just ensuring authenticated users can read their own allowed_modules is covered by existing policies if 'select' is open.
