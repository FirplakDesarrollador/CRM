-- =============================================================================
-- COMMISSION ENGINE FIX: Add missing Foreign Key for Ledger
-- The dashboard query relies on the explicit relationship name
-- 'CRM_ComisionLedger_vendedor_id_fkey' to join with CRM_Usuarios.
-- Date: 2026-02-10
-- =============================================================================

DO $$
BEGIN
    -- unique constraint check
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CRM_ComisionLedger_vendedor_id_fkey'
        AND table_name = 'CRM_ComisionLedger'
    ) THEN
        ALTER TABLE "CRM_ComisionLedger" 
        ADD CONSTRAINT "CRM_ComisionLedger_vendedor_id_fkey" 
        FOREIGN KEY (vendedor_id) 
        REFERENCES "CRM_Usuarios"(id);
    END IF;
END $$;
