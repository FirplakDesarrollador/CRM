-- Migration: Add Opportunity Collaborators
-- Date: 2026-02-11
-- Description: Table to store additional sellers/collaborators for an opportunity.

CREATE TABLE IF NOT EXISTS "CRM_Oportunidades_Colaboradores" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oportunidad_id UUID NOT NULL REFERENCES "CRM_Oportunidades"(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES "CRM_Usuarios"(id),
    porcentaje NUMERIC(5, 2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
    rol VARCHAR(50) DEFAULT 'COLABORADOR', 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_opp_collab_opp ON "CRM_Oportunidades_Colaboradores"(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_opp_collab_user ON "CRM_Oportunidades_Colaboradores"(usuario_id);

ALTER TABLE "CRM_Oportunidades_Colaboradores" ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access to authenticated users" ON "CRM_Oportunidades_Colaboradores" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to authenticated users" ON "CRM_Oportunidades_Colaboradores" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update access to authenticated users" ON "CRM_Oportunidades_Colaboradores" FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete access to authenticated users" ON "CRM_Oportunidades_Colaboradores" FOR DELETE TO authenticated USING (true);
