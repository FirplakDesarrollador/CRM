-- =============================================================================
-- Add Missing RLS Policies for CRM_ReglasBono
-- Date: 2026-02-12
-- Description: Adds INSERT and UPDATE policies for CRM_ReglasBono table
-- =============================================================================

-- Allow INSERT for Admin and Coordinators
CREATE POLICY "Admin/Coord insert bonus rules"
    ON "CRM_ReglasBono" FOR INSERT TO authenticated
    WITH CHECK (is_crm_admin_or_coord());

-- Allow UPDATE for Admin and Coordinators
CREATE POLICY "Admin/Coord update bonus rules"
    ON "CRM_ReglasBono" FOR UPDATE TO authenticated
    USING (is_crm_admin_or_coord())
    WITH CHECK (is_crm_admin_or_coord());
