-- Migration: 20261016000000_add_fecha_entrega_to_oportunidades.sql
-- Descripción: Agrega el campo fecha_entrega (DATE) a la tabla CRM_Oportunidades

ALTER TABLE public."CRM_Oportunidades"
ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

COMMENT ON COLUMN public."CRM_Oportunidades".fecha_entrega IS 'Fecha estimada o comprometida de entrega de los productos de la oportunidad';
