-- Add es_pedido column to CRM_Cotizaciones
ALTER TABLE "CRM_Cotizaciones" 
ADD COLUMN IF NOT EXISTS "es_pedido" BOOLEAN DEFAULT FALSE;

-- Update existing WINNER quotes with SAP data to be pedidos (optional, best guess)
UPDATE "CRM_Cotizaciones"
SET "es_pedido" = TRUE
WHERE "status" = 'WINNER' AND "orden_compra" IS NOT NULL;
