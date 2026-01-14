-- Add es_premium to CRM_Cuentas
ALTER TABLE "CRM_Cuentas" ADD COLUMN IF NOT EXISTS "es_premium" BOOLEAN DEFAULT FALSE;

-- Create Configuration Table
CREATE TABLE IF NOT EXISTS "CRM_Configuracion" (
    "key" TEXT PRIMARY KEY,
    "value" JSONB NOT NULL,
    "description" TEXT
);

-- Enable RLS
ALTER TABLE "CRM_Configuracion" ENABLE ROW LEVEL SECURITY;

-- Policy: Read for everyone (authenticated)
CREATE POLICY "Enable read access for all users" ON "CRM_Configuracion"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Insert/Update/Delete for Admins only
-- We will use a custom claim or just a specific user check for now as requested, 
-- but ideally this should use a proper role system.
-- For this specific request, we verify the user ID or metadata.

CREATE POLICY "Enable write access for admins" ON "CRM_Configuracion"
    FOR ALL USING (
        auth.uid() = '5f203417-b89b-4ac8-a95e-8b3823e5ca7b'::uuid
    );

-- Insert default config
INSERT INTO "CRM_Configuracion" ("key", "value", "description")
VALUES 
    ('min_premium_order_value', '5000000', 'Valor mínimo de pedido para clientes premium')
ON CONFLICT ("key") DO NOTHING;

-- Grant Admin Role (using App Metadata)
-- Update the user's app_metadata to include role: admin
-- Note: This usually requires a secure environment or Supabase Admin API.
-- We can execute a raw SQL update on auth.users if we have permissions, 
-- but normally this is done via Edge Function or Dashboard.
-- We will attempt it via SQL, but it might fail if permissions are restricted.
DO $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = 
        CASE 
            WHEN raw_app_meta_data IS NULL THEN '{"role": "admin"}'::jsonb
            ELSE raw_app_meta_data || '{"role": "admin"}'::jsonb
        END
    WHERE id = '5f203417-b89b-4ac8-a95e-8b3823e5ca7b'::uuid;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if we don't have permission to update auth.users
    NULL;
END $$;
