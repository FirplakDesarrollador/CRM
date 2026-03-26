-- Create Loss Reasons Table
CREATE TABLE IF NOT EXISTS "CRM_RazonesPerdida" (
    "id" SERIAL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Default Reasons
INSERT INTO "CRM_RazonesPerdida" ("descripcion", "is_active") VALUES
('Precio', true),
('Calidad', true),
('Tiempo de entrega', true),
('Especificaciones técnicas', true),
('Competencia', true),
('Presupuesto cancelado', true),
('Falta de seguimiento', true),
('Otro', true);

-- Add Foreign Key to Opportunities
ALTER TABLE "CRM_Oportunidades" 
ADD COLUMN IF NOT EXISTS "razon_perdida_id" INTEGER REFERENCES "CRM_RazonesPerdida"("id");

-- Add index for performance
CREATE INDEX IF NOT EXISTS "idx_oportunidades_razon_perdida" ON "CRM_Oportunidades"("razon_perdida_id");

-- Grant permissions (adjust based on your roles)
GRANT ALL ON "CRM_RazonesPerdida" TO authenticated;
GRANT ALL ON "CRM_RazonesPerdida" TO service_role;
