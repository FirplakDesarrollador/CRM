-- Migration: 20260825_add_opportunity_contacts_and_attended_clients.sql
-- Add multi-contact selection and attended clients count to CRM_Oportunidades

ALTER TABLE "CRM_Oportunidades" 
ADD COLUMN IF NOT EXISTS contactos_ids uuid[] DEFAULT '{}'::uuid[],
ADD COLUMN IF NOT EXISTS clientes_atendidos integer DEFAULT 0;

COMMENT ON COLUMN "CRM_Oportunidades"."contactos_ids" IS 'IDs de los contactos asociados a la oportunidad';
COMMENT ON COLUMN "CRM_Oportunidades"."clientes_atendidos" IS 'Número de clientes atendidos en la oportunidad';
