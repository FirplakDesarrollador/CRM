-- =====================================================
-- MIGRATION: Enable RLS and Create Policies for All Tables
-- Date: 2026-02-13
-- Description: Enable Row Level Security (RLS) on all tables and create
--              permissive policies allowing authenticated users to perform
--              all CRUD operations (SELECT, INSERT, UPDATE, DELETE)
-- =====================================================

-- This migration is idempotent - it can be run multiple times safely
-- It will drop existing policies and recreate them

BEGIN;

-- =====================================================
-- HELPER FUNCTION: Create RLS policies for a table
-- =====================================================
CREATE OR REPLACE FUNCTION create_rls_policies_for_table(table_name TEXT)
RETURNS void AS $$
BEGIN
    -- Enable RLS on the table
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    
    -- Drop existing policies if they exist (to make this idempotent)
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users to select" ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users to insert" ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users to update" ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users to delete" ON %I', table_name);
    
    -- Create SELECT policy
    EXECUTE format('CREATE POLICY "Allow authenticated users to select" ON %I FOR SELECT TO authenticated USING (true)', table_name);
    
    -- Create INSERT policy
    EXECUTE format('CREATE POLICY "Allow authenticated users to insert" ON %I FOR INSERT TO authenticated WITH CHECK (true)', table_name);
    
    -- Create UPDATE policy
    EXECUTE format('CREATE POLICY "Allow authenticated users to update" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', table_name);
    
    -- Create DELETE policy
    EXECUTE format('CREATE POLICY "Allow authenticated users to delete" ON %I FOR DELETE TO authenticated USING (true)', table_name);
    
    RAISE NOTICE 'Created RLS policies for table: %', table_name;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Table % does not exist, skipping', table_name;
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating policies for %: %', table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- APPLY RLS POLICIES TO ALL TABLES
-- =====================================================

-- Main Schema Tables (from schema.sql)
SELECT create_rls_policies_for_table('CRM_Currencies');
SELECT create_rls_policies_for_table('CRM_ExchangeRates');
SELECT create_rls_policies_for_table('CRM_EstadosOportunidad');
SELECT create_rls_policies_for_table('CRM_FasesOportunidad');
SELECT create_rls_policies_for_table('CRM_TiposActividad');
SELECT create_rls_policies_for_table('CRM_Productos');
SELECT create_rls_policies_for_table('CRM_Parameters');
SELECT create_rls_policies_for_table('CRM_Files');
SELECT create_rls_policies_for_table('CRM_SapIntegrationQueue');
SELECT create_rls_policies_for_table('CRM_Usuarios');
SELECT create_rls_policies_for_table('CRM_Cuentas');
SELECT create_rls_policies_for_table('CRM_Contactos');
SELECT create_rls_policies_for_table('CRM_Oportunidades');
SELECT create_rls_policies_for_table('CRM_OportunidadColaboradores');
SELECT create_rls_policies_for_table('CRM_TransferenciasOportunidad');
SELECT create_rls_policies_for_table('CRM_Actividades');
SELECT create_rls_policies_for_table('CRM_Cotizaciones');
SELECT create_rls_policies_for_table('CRM_CotizacionItems');

-- Additional Tables from Migrations
SELECT create_rls_policies_for_table('CRM_Canales');
SELECT create_rls_policies_for_table('CRM_Audit_Cuentas');
SELECT create_rls_policies_for_table('CRM_Configuracion');
SELECT create_rls_policies_for_table('CRM_Segmentos');
SELECT create_rls_policies_for_table('CRM_Subclasificacion');
SELECT create_rls_policies_for_table('CRM_Departamentos');
SELECT create_rls_policies_for_table('CRM_Ciudades');
SELECT create_rls_policies_for_table('CRM_Activity_Clasificacion');
SELECT create_rls_policies_for_table('CRM_Activity_Subclasificacion');
SELECT create_rls_policies_for_table('CRM_Metas');
SELECT create_rls_policies_for_table('CRM_RazonesPerdida');

-- Commission System Tables
SELECT create_rls_policies_for_table('CRM_ComisionCategorias');
SELECT create_rls_policies_for_table('CRM_ComisionReglas');
SELECT create_rls_policies_for_table('CRM_ReglasBono');
SELECT create_rls_policies_for_table('CRM_Pagos');
SELECT create_rls_policies_for_table('CRM_ComisionLedger');

-- Collaboration Tables
SELECT create_rls_policies_for_table('CRM_Oportunidades_Colaboradores');

-- Notification System Tables
SELECT create_rls_policies_for_table('CRM_NotificationRules');
SELECT create_rls_policies_for_table('CRM_Notifications');

-- Price List Tables
SELECT create_rls_policies_for_table('CRM_ListaDePrecios');

-- Microsoft Integration Tables
SELECT create_rls_policies_for_table('CRM_MicrosoftTokens');

-- Discount Tables
SELECT create_rls_policies_for_table('CRM_VolumeDiscounts');
SELECT create_rls_policies_for_table('CRM_PremiumClients');

-- Quote Segments
SELECT create_rls_policies_for_table('CRM_QuoteSegments');

-- Coordinators
SELECT create_rls_policies_for_table('CRM_Coordinadores');

-- =====================================================
-- CLEANUP: Drop the helper function
-- =====================================================
DROP FUNCTION IF EXISTS create_rls_policies_for_table(TEXT);

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these queries after migration to verify RLS is enabled:

-- 1. Check which tables have RLS enabled
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename LIKE 'CRM_%'
-- ORDER BY tablename;

-- 2. Check policies for a specific table
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'CRM_Productos';

-- 3. Count policies per table
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename LIKE 'CRM_%'
-- GROUP BY tablename
-- ORDER BY tablename;
