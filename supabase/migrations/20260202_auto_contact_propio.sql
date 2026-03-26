-- MIGRATION: AUTO CREATE CONTACT FOR PROPIO CHANNEL
-- Description: Automatically creates a contact when an ACCOUNT is created for 'PROPIO' channel.
-- CORRECTED: Trigger on CRM_Cuentas, not CRM_Oportunidades

BEGIN;

-- 1. Drop old trigger if exists (from previous incorrect version)
DROP TRIGGER IF EXISTS trg_auto_create_contact_propio ON "CRM_Oportunidades";
DROP FUNCTION IF EXISTS auto_create_contact_propio();

-- 2. Create the NEW Trigger Function (on Account creation)
CREATE OR REPLACE FUNCTION auto_create_contact_for_propio_account() RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if channel is 'PROPIO'
    IF NEW.canal_id = 'PROPIO' THEN
        -- Insert the contact with account data
        INSERT INTO "CRM_Contactos" (
            account_id, 
            nombre, 
            cargo, 
            telefono, 
            email, 
            es_principal,
            created_by
        ) VALUES (
            NEW.id,
            NEW.nombre,
            'Cliente final',
            NEW.telefono,
            NEW.email,
            TRUE,
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the Trigger on CRM_Cuentas
DROP TRIGGER IF EXISTS trg_auto_create_contact_for_propio_account ON "CRM_Cuentas";
CREATE TRIGGER trg_auto_create_contact_for_propio_account
AFTER INSERT ON "CRM_Cuentas"
FOR EACH ROW EXECUTE FUNCTION auto_create_contact_for_propio_account();

COMMIT;
