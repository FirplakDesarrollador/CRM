-- Create table for Goals (Metas) with Enhanced Configuration
-- Dropping first to ensure clean state if re-running
DROP TABLE IF EXISTS "CRM_Metas";

CREATE TABLE "CRM_Metas" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "CRM_Usuarios"(id) ON DELETE CASCADE,
    
    -- Goal Configuration
    goal_type VARCHAR NOT NULL CHECK (goal_type IN ('SPECIFIC_OPPORTUNITY', 'WON_COUNT', 'CONTACT_COUNT', 'TOTAL_OPPORTUNITIES')),
    target_value INT DEFAULT 0, -- For counts (e.g., 5 sales)
    opportunity_id UUID REFERENCES "CRM_Oportunidades"(id) ON DELETE SET NULL, -- Only if type is SPECIFIC_OPPORTUNITY
    
    description TEXT,
    status VARCHAR DEFAULT 'En Proceso' CHECK (status IN ('En Proceso', 'Terminado', 'Fracasada')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- RLS Policies
ALTER TABLE "CRM_Metas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissive All" ON "CRM_Metas" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_crm_metas_user ON "CRM_Metas"(user_id);
