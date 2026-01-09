-- Migration script to safely replace OBRAS_INT phases

DO $$ 
DECLARE 
    new_visita_id bigint;
BEGIN
    -- 1. Create the new 'Contacto inicial' phase first to get its ID (fallback)
    INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") 
    VALUES ('Contacto inicial', 1, true, 'OBRAS_INT') 
    RETURNING id INTO new_visita_id;

    -- 2. Create the rest of the new phases
    INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") VALUES
    ('Presentación de portafolio', 2, true, 'OBRAS_INT'),
    ('Acuerdo de precios', 3, true, 'OBRAS_INT'),
    ('Recepción de planos', 4, true, 'OBRAS_INT'),
    ('Negociación final', 5, true, 'OBRAS_INT'),
    ('Cerrada ganada', 6, true, 'OBRAS_INT'),
    ('Cerrada Perdida', 7, true, 'OBRAS_INT');

    -- 3. MIGRATE EXISTING OPPORTUNITIES (Fix FK Error)
    UPDATE "CRM_Oportunidades"
    SET "fase_id" = new_visita_id
    WHERE "fase_id" IN (
        SELECT id FROM "CRM_FasesOportunidad" 
        WHERE "canal_id" = 'OBRAS_INT' 
        AND id <> new_visita_id
    );

    -- 4. DELETE OLD PHASES
    DELETE FROM "CRM_FasesOportunidad" 
    WHERE "canal_id" = 'OBRAS_INT' 
    AND id NOT IN (
        SELECT id FROM "CRM_FasesOportunidad" 
        WHERE "canal_id" = 'OBRAS_INT' 
        AND "nombre" IN ('Contacto inicial', 'Presentación de portafolio', 'Acuerdo de precios', 'Recepción de planos', 'Negociación final', 'Cerrada ganada', 'Cerrada Perdida')
    );
    
END $$;
