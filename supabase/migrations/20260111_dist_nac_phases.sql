-- Migration script to safely replace DIST_NAC phases

DO $$ 
DECLARE 
    new_visita_id bigint;
BEGIN
    -- 1. Create the new 'Visita' phase first to get its ID (fallback)
    INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") 
    VALUES ('Visita', 1, true, 'DIST_NAC') 
    RETURNING id INTO new_visita_id;

    -- 2. Create the rest of the new phases
    INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") VALUES
    ('Presentación de propuesta', 2, true, 'DIST_NAC'),
    ('Acuerdo de precios', 3, true, 'DIST_NAC'),
    ('Esperando pedido', 4, true, 'DIST_NAC'),
    ('Cerrada ganada', 5, true, 'DIST_NAC'),
    ('Cerrada Perdida', 6, true, 'DIST_NAC');

    -- 3. MIGRATE EXISTING OPPORTUNITIES (Fix FK Error)
    UPDATE "CRM_Oportunidades"
    SET "fase_id" = new_visita_id
    WHERE "fase_id" IN (
        SELECT id FROM "CRM_FasesOportunidad" 
        WHERE "canal_id" = 'DIST_NAC' 
        AND id <> new_visita_id
    );

    -- 4. DELETE OLD PHASES
    DELETE FROM "CRM_FasesOportunidad" 
    WHERE "canal_id" = 'DIST_NAC' 
    AND id NOT IN (
        SELECT id FROM "CRM_FasesOportunidad" 
        WHERE "canal_id" = 'DIST_NAC' 
        AND "nombre" IN ('Visita', 'Presentación de propuesta', 'Acuerdo de precios', 'Esperando pedido', 'Cerrada ganada', 'Cerrada Perdida')
    );
    
END $$;
