-- Migration: Add S&OP support columns to CRM_ListaDePrecios and CRM_Productos (Planta and Familia)

-- 1. Add to CRM_ListaDePrecios (Primary Source of truth for products in CRM)
ALTER TABLE "CRM_ListaDePrecios" 
ADD COLUMN IF NOT EXISTS "planta" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "familia" VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_crm_listaprecios_planta ON "CRM_ListaDePrecios"("planta");
CREATE INDEX IF NOT EXISTS idx_crm_listaprecios_familia ON "CRM_ListaDePrecios"("familia");

-- 2. Add to CRM_Productos (Redundant table for reference)
ALTER TABLE "CRM_Productos" 
ADD COLUMN IF NOT EXISTS "planta" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "familia" VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_crm_productos_planta ON "CRM_Productos"("planta");
CREATE INDEX IF NOT EXISTS idx_crm_productos_familia ON "CRM_Productos"("familia");
