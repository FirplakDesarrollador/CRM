-- Migration: Add mandatory order fields to CRM_Cotizaciones and CRM_Pedidos
ALTER TABLE public."CRM_Cotizaciones"
ADD COLUMN IF NOT EXISTS cierre_facturacion BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS es_muestra BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verificacion_previa_firplak BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS direccion_envio_factura TEXT;

ALTER TABLE public."CRM_Pedidos"
ADD COLUMN IF NOT EXISTS cierre_facturacion BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS es_muestra BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verificacion_previa_firplak BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS direccion_envio_factura TEXT;

COMMENT ON COLUMN public."CRM_Cotizaciones".cierre_facturacion IS 'Indica si aplica cierre de facturación';
COMMENT ON COLUMN public."CRM_Cotizaciones".es_muestra IS 'Indica si el pedido es muestra';
COMMENT ON COLUMN public."CRM_Cotizaciones".verificacion_previa_firplak IS 'Verificación previa por personal Firplak';
COMMENT ON COLUMN public."CRM_Cotizaciones".direccion_envio_factura IS 'Dirección exacta de envío de la factura';
