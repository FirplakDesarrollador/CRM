-- Create sequence for CRM_Pedidos id
CREATE SEQUENCE IF NOT EXISTS "CRM_Pedidos_id_seq" START 1000000000;
ALTER TABLE "CRM_Pedidos" ALTER COLUMN id SET DEFAULT nextval('"CRM_Pedidos_id_seq"');

-- Add new columns for native app integration
ALTER TABLE "CRM_Pedidos" ADD COLUMN IF NOT EXISTS "uuid_generado" UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE "CRM_Pedidos" ADD COLUMN IF NOT EXISTS "cotizacion_id" UUID REFERENCES "CRM_Cotizaciones"("id") ON DELETE CASCADE;
ALTER TABLE "CRM_Pedidos" ADD COLUMN IF NOT EXISTS "opportunity_id" UUID REFERENCES "CRM_Oportunidades"("id") ON DELETE SET NULL;
ALTER TABLE "CRM_Pedidos" ADD COLUMN IF NOT EXISTS "estado_pedido" VARCHAR DEFAULT 'PLANEADO';

-- Table for tracking line items split into this order
CREATE TABLE IF NOT EXISTS "CRM_PedidoItems" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "pedido_uuid" UUID REFERENCES "CRM_Pedidos"("uuid_generado") ON DELETE CASCADE,
    "producto_id" UUID REFERENCES "CRM_Productos"("id"),
    "cantidad" NUMERIC NOT NULL,
    "precio_unitario" NUMERIC,
    "descuento" NUMERIC DEFAULT 0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for CRM_PedidoItems
ALTER TABLE "CRM_PedidoItems" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated users" 
ON "CRM_PedidoItems" AS PERMISSIVE FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
