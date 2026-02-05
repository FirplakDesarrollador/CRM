-- Add probability column to CRM_FasesOportunidad
ALTER TABLE "CRM_FasesOportunidad" ADD COLUMN IF NOT EXISTS probability INT DEFAULT 0;

-- Add probability column to CRM_Oportunidades
ALTER TABLE "CRM_Oportunidades" ADD COLUMN IF NOT EXISTS probability INT DEFAULT 0;

-- Update probabilities for OBRAS_INT
UPDATE "CRM_FasesOportunidad" SET probability = 5 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Contacto inicial';
UPDATE "CRM_FasesOportunidad" SET probability = 20 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Presentación de portafolio';
UPDATE "CRM_FasesOportunidad" SET probability = 30 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Acuerdo de precios';
UPDATE "CRM_FasesOportunidad" SET probability = 50 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Recepción de planos';
UPDATE "CRM_FasesOportunidad" SET probability = 80 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Negociación final';
UPDATE "CRM_FasesOportunidad" SET probability = 100 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Cerrada ganada';
UPDATE "CRM_FasesOportunidad" SET probability = 0 WHERE canal_id = 'OBRAS_INT' AND nombre = 'Cerrada Perdida';

-- Update probabilities for OBRAS_NAC
UPDATE "CRM_FasesOportunidad" SET probability = 5 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Visita';
UPDATE "CRM_FasesOportunidad" SET probability = 10 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Presentación de propuesta';
UPDATE "CRM_FasesOportunidad" SET probability = 20 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Acuerdo de precios';
UPDATE "CRM_FasesOportunidad" SET probability = 50 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Especificación / Modelo';
UPDATE "CRM_FasesOportunidad" SET probability = 80 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Negociación final';
UPDATE "CRM_FasesOportunidad" SET probability = 100 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Cerrada Ganada';
UPDATE "CRM_FasesOportunidad" SET probability = 0 WHERE canal_id = 'OBRAS_NAC' AND nombre = 'Cerrada Perdida';

-- Update probabilities for DIST_INT
UPDATE "CRM_FasesOportunidad" SET probability = 5 WHERE canal_id = 'DIST_INT' AND nombre = 'Visita';
UPDATE "CRM_FasesOportunidad" SET probability = 20 WHERE canal_id = 'DIST_INT' AND nombre = 'Presentación de propuesta';
UPDATE "CRM_FasesOportunidad" SET probability = 50 WHERE canal_id = 'DIST_INT' AND nombre = 'Acuerdo de precios';
UPDATE "CRM_FasesOportunidad" SET probability = 80 WHERE canal_id = 'DIST_INT' AND nombre = 'Envío de proforma';
UPDATE "CRM_FasesOportunidad" SET probability = 100 WHERE canal_id = 'DIST_INT' AND nombre = 'Cerrada ganada';
UPDATE "CRM_FasesOportunidad" SET probability = 0 WHERE canal_id = 'DIST_INT' AND nombre = 'Cerrada Perdida';

-- Update probabilities for DIST_NAC
UPDATE "CRM_FasesOportunidad" SET probability = 5 WHERE canal_id = 'DIST_NAC' AND nombre = 'Visita';
UPDATE "CRM_FasesOportunidad" SET probability = 20 WHERE canal_id = 'DIST_NAC' AND nombre = 'Presentación de propuesta';
UPDATE "CRM_FasesOportunidad" SET probability = 50 WHERE canal_id = 'DIST_NAC' AND nombre = 'Acuerdo de precios';
UPDATE "CRM_FasesOportunidad" SET probability = 80 WHERE canal_id = 'DIST_NAC' AND nombre = 'Esperando pedido';
UPDATE "CRM_FasesOportunidad" SET probability = 100 WHERE canal_id = 'DIST_NAC' AND nombre = 'Cerrada ganada';
UPDATE "CRM_FasesOportunidad" SET probability = 0 WHERE canal_id = 'DIST_NAC' AND nombre = 'Cerrada Perdida';

-- Update probabilities for PROPIO
UPDATE "CRM_FasesOportunidad" SET probability = 5 WHERE canal_id = 'PROPIO' AND nombre = 'Primer contacto';
UPDATE "CRM_FasesOportunidad" SET probability = 10 WHERE canal_id = 'PROPIO' AND nombre = 'Presentación de propuesta';
UPDATE "CRM_FasesOportunidad" SET probability = 20 WHERE canal_id = 'PROPIO' AND nombre = 'Acuerdo de precios';
UPDATE "CRM_FasesOportunidad" SET probability = 50 WHERE canal_id = 'PROPIO' AND nombre = 'Negociación final';
UPDATE "CRM_FasesOportunidad" SET probability = 90 WHERE canal_id = 'PROPIO' AND nombre = 'Esperando pedido';
UPDATE "CRM_FasesOportunidad" SET probability = 100 WHERE canal_id = 'PROPIO' AND nombre = 'Cerrada ganada';
UPDATE "CRM_FasesOportunidad" SET probability = 0 WHERE canal_id = 'PROPIO' AND nombre = 'Cerrada Perdida';


-- Create Function and Trigger to auto-update probability
CREATE OR REPLACE FUNCTION update_opportunity_probability() RETURNS TRIGGER AS $$
DECLARE
    v_probability INT;
BEGIN
    -- Get probability from the phase
    SELECT probability INTO v_probability
    FROM "CRM_FasesOportunidad"
    WHERE id = NEW.fase_id;

    -- Update the probability on the opportunity
    NEW.probability := COALESCE(v_probability, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_opportunity_probability ON "CRM_Oportunidades";
CREATE TRIGGER trg_update_opportunity_probability
BEFORE INSERT OR UPDATE OF fase_id ON "CRM_Oportunidades"
FOR EACH ROW EXECUTE FUNCTION update_opportunity_probability();

-- Backfill existing opportunities
UPDATE "CRM_Oportunidades" AS opp
SET probability = phases.probability
FROM "CRM_FasesOportunidad" AS phases
WHERE opp.fase_id = phases.id;
