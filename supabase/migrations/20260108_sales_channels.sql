-- MIGRATION: SALES CHANNELS & PRICING LOGIC
-- Description: Implements 5 sales channels, links them to accounts and phases, and creates pricing functions.

BEGIN;

-- 1. CREATE MASTER TABLE: CRM_Canales
CREATE TABLE IF NOT EXISTS "CRM_Canales" (
    id VARCHAR(20) PRIMARY KEY, -- OBRAS_NAC, etc.
    nombre VARCHAR(50) NOT NULL,
    columna_precio VARCHAR(50) NOT NULL, -- Columna en CRM_ListaDePrecios
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 5 immutable channels
-- Check CRM_ListaDePrecios columns validity before inserting
INSERT INTO "CRM_Canales" (id, nombre, columna_precio) VALUES
    ('OBRAS_NAC', 'Obras Nacional', 'lista_base_obras'),
    ('OBRAS_INT', 'Obras Internacional', 'lista_base_exportaciones'),
    ('DIST_NAC', 'Distribución Nacional', 'lista_base_cop'),
    ('DIST_INT', 'Distribución Internacional', 'lista_base_exportaciones'),
    ('PROPIO', 'Canal Propio (B2C)', 'distribuidor_pvp_iva')
ON CONFLICT (id) DO UPDATE 
SET nombre = EXCLUDED.nombre, columna_precio = EXCLUDED.columna_precio;


-- 2. MODIFY ACCOUNTS (CRM_Cuentas)
-- Add column nullable first
ALTER TABLE "CRM_Cuentas" ADD COLUMN IF NOT EXISTS canal_id VARCHAR(20);

-- Update FK
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crmcuentas_canal') THEN
        ALTER TABLE "CRM_Cuentas" DROP CONSTRAINT fk_crmcuentas_canal;
    END IF;
END $$;

ALTER TABLE "CRM_Cuentas" 
    ADD CONSTRAINT fk_crmcuentas_canal 
    FOREIGN KEY (canal_id) REFERENCES "CRM_Canales"(id);

-- Backfill existing accounts (Default to DIST_NAC)
UPDATE "CRM_Cuentas" SET canal_id = 'DIST_NAC' WHERE canal_id IS NULL;

-- Set NOT NULL
ALTER TABLE "CRM_Cuentas" ALTER COLUMN canal_id SET NOT NULL;


-- 3. AUDIT TRAIL FOR ACCOUNTS
CREATE TABLE IF NOT EXISTS "CRM_Audit_Cuentas" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    field_changed VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID, -- Supabase User ID
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION audit_account_changes() RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.canal_id IS DISTINCT FROM NEW.canal_id) THEN
        INSERT INTO "CRM_Audit_Cuentas" (account_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.id, 'canal_id', OLD.canal_id, NEW.canal_id, auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_account_changes ON "CRM_Cuentas";
CREATE TRIGGER trg_audit_account_changes
AFTER UPDATE ON "CRM_Cuentas"
FOR EACH ROW EXECUTE FUNCTION audit_account_changes();


-- 4. MODIFY PHASES (CRM_FasesOportunidad)
-- Add channel_id
ALTER TABLE "CRM_FasesOportunidad" ADD COLUMN IF NOT EXISTS canal_id VARCHAR(20);

-- FK
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crmfases_canal') THEN
        ALTER TABLE "CRM_FasesOportunidad" DROP CONSTRAINT fk_crmfases_canal;
    END IF;
END $$;

ALTER TABLE "CRM_FasesOportunidad" 
    ADD CONSTRAINT fk_crmfases_canal 
    FOREIGN KEY (canal_id) REFERENCES "CRM_Canales"(id);

-- STRATEGY: Duplicate existing generic phases for EACH channel to initialize
-- First, verify if we have generic phases (null canal_id)
DO $$
DECLARE
    r_canal RECORD;
BEGIN
    -- Only proceed if we have phases with null canal_id
    IF EXISTS (SELECT 1 FROM "CRM_FasesOportunidad" WHERE canal_id IS NULL) THEN
        
        -- Loop through all channels
        FOR r_canal IN SELECT id FROM "CRM_Canales" LOOP
            -- Duplicate generic phases for this channel
            INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id)
            SELECT nombre, orden, is_active, r_canal.id
            FROM "CRM_FasesOportunidad"
            WHERE canal_id IS NULL;
        END LOOP;

        -- RE-LINK EXISTING OPPORTUNITIES to the new phases based on Account Channel
        -- This prevents FK violation when deleting old phases
        UPDATE "CRM_Oportunidades" AS opp
        SET fase_id = new_phase.id
        FROM "CRM_FasesOportunidad" AS old_phase,
             "CRM_FasesOportunidad" AS new_phase,
             "CRM_Cuentas" AS acc
        WHERE opp.fase_id = old_phase.id
          AND old_phase.canal_id IS NULL
          AND opp.account_id = acc.id
          AND old_phase.nombre = new_phase.nombre
          AND new_phase.canal_id = acc.canal_id;

        -- Delete the old generic phases to enforce strict integrity
        DELETE FROM "CRM_FasesOportunidad" WHERE canal_id IS NULL;
    END IF;
END $$;

-- Enforce NOT NULL on canal_id for phases now
ALTER TABLE "CRM_FasesOportunidad" ALTER COLUMN canal_id SET NOT NULL;


-- 5. PRICING FUNCTION
-- Returns the price of a product for a specific channel
CREATE OR REPLACE FUNCTION get_producto_precio_canal(p_producto_id UUID, p_canal_id VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_columna VARCHAR;
    v_precio NUMERIC;
    v_query TEXT;
BEGIN
    -- 1. Get column name for the channel
    SELECT columna_precio INTO v_columna
    FROM "CRM_Canales"
    WHERE id = p_canal_id;

    IF v_columna IS NULL THEN
        RAISE EXCEPTION 'Canal no encontrado o sin columna de precio configurada';
    END IF;

    -- 2. Dynamic Query to select the specific column from CRM_ListaDePrecios
    -- We use format() to safely inject the identifier
    v_query := format('SELECT %I FROM "CRM_ListaDePrecios" WHERE id = $1', v_columna);

    EXECUTE v_query INTO v_precio USING p_producto_id;

    -- Return 0 if null
    RETURN COALESCE(v_precio, 0);
END;
$$ LANGUAGE plpgsql;


-- 6. RPC Helper for Frontend to get available phases for an Account
-- This simplifies fetching phases: pass account_id, get phases.
CREATE OR REPLACE FUNCTION get_fases_para_cuenta(p_account_id UUID)
RETURNS TABLE (
    id INT,
    nombre VARCHAR,
    orden INT,
    canal_id VARCHAR
) AS $$
DECLARE
    v_canal_id VARCHAR;
BEGIN
    SELECT c.canal_id INTO v_canal_id
    FROM "CRM_Cuentas" c
    WHERE c.id = p_account_id;

    RETURN QUERY
    SELECT f.id, f.nombre, f.orden, f.canal_id
    FROM "CRM_FasesOportunidad" f
    WHERE f.canal_id = v_canal_id
    ORDER BY f.orden ASC;
END;
$$ LANGUAGE plpgsql;

COMMIT;
