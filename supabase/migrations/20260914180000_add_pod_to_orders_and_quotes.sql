-- Migration: Add tipo_pod and pod fields to CRM_Pedidos and CRM_Cotizaciones
-- Default value is 'POD Total' as requested.

ALTER TABLE public."CRM_Pedidos"
    ADD COLUMN IF NOT EXISTS tipo_pod TEXT DEFAULT 'POD Total',
    ADD COLUMN IF NOT EXISTS pod TEXT DEFAULT 'POD Total';

ALTER TABLE public."CRM_Cotizaciones"
    ADD COLUMN IF NOT EXISTS tipo_pod TEXT DEFAULT 'POD Total',
    ADD COLUMN IF NOT EXISTS pod TEXT DEFAULT 'POD Total';

COMMENT ON COLUMN public."CRM_Pedidos".tipo_pod IS 'Tipo de POD: POD Total, POD Parcial, Sin POD';
COMMENT ON COLUMN public."CRM_Pedidos".pod IS 'Tipo de POD: POD Total, POD Parcial, Sin POD';
COMMENT ON COLUMN public."CRM_Cotizaciones".tipo_pod IS 'Tipo de POD: POD Total, POD Parcial, Sin POD';
COMMENT ON COLUMN public."CRM_Cotizaciones".pod IS 'Tipo de POD: POD Total, POD Parcial, Sin POD';
