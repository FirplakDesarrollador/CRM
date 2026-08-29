-- Add origen_cuenta column to CRM_Cuentas
ALTER TABLE "CRM_Cuentas"
    ADD COLUMN IF NOT EXISTS origen_cuenta TEXT;

COMMENT ON COLUMN "CRM_Cuentas".origen_cuenta IS 'Origen de captación o procedencia de la cuenta (ej. Referido, Feria, Publicidad, Web, etc.)';
