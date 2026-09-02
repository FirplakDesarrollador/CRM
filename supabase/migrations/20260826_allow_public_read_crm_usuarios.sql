-- Allow public and authenticated read access to CRM_Usuarios for directory lookups and user management
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'CRM_Usuarios' 
        AND policyname = 'Allow read access to public for CRM_Usuarios'
    ) THEN
        CREATE POLICY "Allow read access to public for CRM_Usuarios" 
        ON "CRM_Usuarios" 
        FOR SELECT 
        TO public 
        USING (true);
    END IF;
END $$;
