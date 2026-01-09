-- Migration script to safely replace OBRAS_NAC phases
-- This uses a transaction block to:
-- 1. Create new phases
-- 2. Move existing opportunities to the new 'Visita' phase (to satisfy FKs)
-- 3. Delete old phases

DO $$ 
DECLARE 
    new_visita_id bigint;
BEGIN
    -- 1. Create the new 'Visita' phase first to get its ID
    INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") 
    VALUES ('Visita', 1, true, 'OBRAS_NAC') 
    RETURNING id INTO new_visita_id;

    -- 2. Create the rest of the new phases
    INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") VALUES
    ('Presentación de propuesta', 2, true, 'OBRAS_NAC'),
    ('Acuerdo de precios', 3, true, 'OBRAS_NAC'),
    ('Especificación / Modelo', 4, true, 'OBRAS_NAC'),
    ('Negociación final', 5, true, 'OBRAS_NAC'),
    ('Cerrada Ganada', 6, true, 'OBRAS_NAC'),
    ('Cerrada Perdida', 7, true, 'OBRAS_NAC');

    -- 3. MIGRATE EXISTING OPPORTUNITIES
    -- Update any opportunity currently in an OBRAS_NAC phase to the new 'Visita' phase.
    -- This unlinks them from the old phases so we can delete the old phases.
    UPDATE "CRM_Oportunidades"
    SET "fase_id" = new_visita_id
    WHERE "fase_id" IN (
        SELECT id FROM "CRM_FasesOportunidad" 
        WHERE "canal_id" = 'OBRAS_NAC' 
        AND id <> new_visita_id
    );

    -- 4. DELETE OLD PHASES
    -- Now safe to delete old phases as no opportunities reference them
    DELETE FROM "CRM_FasesOportunidad" 
    WHERE "canal_id" = 'OBRAS_NAC' 
    AND id NOT IN (
        SELECT id FROM "CRM_FasesOportunidad" 
        WHERE "canal_id" = 'OBRAS_NAC' 
        AND "nombre" IN ('Visita', 'Presentación de propuesta', 'Acuerdo de precios', 'Especificación / Modelo', 'Negociación final', 'Cerrada Ganada', 'Cerrada Perdida')
    );
    
END $$;
