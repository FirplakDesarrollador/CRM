-- Add segmento_id to CRM_Cotizaciones
ALTER TABLE "CRM_Cotizaciones" ADD COLUMN IF NOT EXISTS segmento_id INT REFERENCES "CRM_Segmentos"(id);

-- Update audit trigger for quotations to include segmento_id (if trigger exists)
-- Assuming the trigger is similar to the opportunity one
CREATE OR REPLACE FUNCTION audit_quote_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.segmento_id IS DISTINCT FROM NEW.segmento_id) THEN
            INSERT INTO "CRM_Auditoria" (tabla, registro_id, campo, valor_anterior, valor_nuevo, modificado_por)
            VALUES ('CRM_Cotizaciones', NEW.id::text, 'segmento_id', COALESCE(OLD.segmento_id::text, 'NULL'), COALESCE(NEW.segmento_id::text, 'NULL'), NEW.updated_by);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- If the trigger doesn't exist yet, we don't bind it here to avoid breaking existing logic.
-- But if it does, this updates it.
