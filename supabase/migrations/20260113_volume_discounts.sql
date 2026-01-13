-- MIGRATION: VOLUME DISCOUNTS SYSTEM
-- Description: Adds JSONB volume discounts to Pricing List and implements calculation logic.

BEGIN;

-- 1. ALTER TABLE: Add JSONB column for volume discounts
ALTER TABLE "CRM_ListaDePrecios" 
ADD COLUMN IF NOT EXISTS descuentos_volumen JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN "CRM_ListaDePrecios".descuentos_volumen IS 'Stores volume discounts per channel. Format: {"CHANNEL_ID": [{"min_qty": 10, "discount_pct": 5}, ...]}';

-- 2. FUNCTION: Get Base Price (Dynamic Column Selection)
-- Returns the base price for a product given a channel ID.
CREATE OR REPLACE FUNCTION public.get_base_price(
    p_numero_articulo text, 
    p_canal_id varchar
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_columna varchar;
    v_precio numeric;
    v_query text;
BEGIN
    -- 1. Get the price column name for the channel
    SELECT columna_precio INTO v_columna
    FROM "CRM_Canales"
    WHERE id = p_canal_id;

    IF v_columna IS NULL THEN
        RAISE EXCEPTION 'Canal ID % not found or has no price column', p_canal_id;
    END IF;

    -- 2. Construct dynamic query to get price
    -- White-listing columns is good practice, but for simplicity we assume CRM_Canales data is trusted.
    -- We use format() to safely assume column name is an identifier.
    v_query := format('SELECT %I FROM "CRM_ListaDePrecios" WHERE numero_articulo = $1 LIMIT 1', v_columna);
    
    EXECUTE v_query INTO v_precio USING p_numero_articulo;

    RETURN COALESCE(v_precio, 0);
END;
$$;

-- 3. FUNCTION: Get Discount Percentage (JSONB Logic)
-- returns the applicable discount percentage based on quantity and channel.
CREATE OR REPLACE FUNCTION public.get_discount_pct_from_json(
    p_numero_articulo text,
    p_canal_id varchar,
    p_qty int
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_json jsonb;
    v_scales jsonb;
    v_best_match numeric := 0;
BEGIN
    -- 1. Get the JSONB blob
    SELECT descuentos_volumen INTO v_json
    FROM "CRM_ListaDePrecios"
    WHERE numero_articulo = p_numero_articulo;

    IF v_json IS NULL OR v_json = '{}'::jsonb THEN
        RETURN 0;
    END IF;

    -- 2. Extract scales for the specific channel
    v_scales := v_json -> p_canal_id;

    IF v_scales IS NULL OR jsonb_array_length(v_scales) = 0 THEN
        RETURN 0;
    END IF;

    -- 3. Find the highest discount for min_qty <= p_qty
    -- We can do this via SQL query on the jsonb array
    SELECT COALESCE(MAX((elem->>'discount_pct')::numeric), 0) INTO v_best_match
    FROM jsonb_array_elements(v_scales) AS elem
    WHERE (elem->>'min_qty')::int <= p_qty;

    RETURN v_best_match;
END;
$$;

-- 4. FUNCTION: Get Recommended Pricing (Composite Result)
-- Returns full pricing breakdown
CREATE OR REPLACE FUNCTION public.get_recommended_pricing(
    p_numero_articulo text,
    p_canal_id varchar,
    p_qty int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_price numeric;
    v_discount_pct numeric;
    v_final_unit_price numeric;
BEGIN
    -- Get components
    v_base_price := public.get_base_price(p_numero_articulo, p_canal_id);
    v_discount_pct := public.get_discount_pct_from_json(p_numero_articulo, p_canal_id, p_qty);

    -- Calculate final
    v_final_unit_price := v_base_price * (1 - (v_discount_pct / 100.0));

    -- Return JSON object
    RETURN jsonb_build_object(
        'base_price', v_base_price,
        'discount_pct', v_discount_pct,
        'final_unit_price', ROUND(v_final_unit_price, 2) -- Rounding to 2 decimals usually standard
    );
END;
$$;

-- 5. VALIDATION TRIGGER (Optional but recommended)
-- Ensures integrity of the JSONB structure
CREATE OR REPLACE FUNCTION validate_descuentos_volumen()
RETURNS TRIGGER AS $$
DECLARE
    chn text;
    scale jsonb;
    elem jsonb;
BEGIN
    IF NEW.descuentos_volumen IS NOT NULL THEN
        -- Iterate over keys (channels)
        FOR chn IN SELECT jsonb_object_keys(NEW.descuentos_volumen)
        LOOP
            scale := NEW.descuentos_volumen -> chn;
            
            -- Must be an array
            IF jsonb_typeof(scale) <> 'array' THEN
                RAISE EXCEPTION 'Discounts for channel % must be an array', chn;
            END IF;

            -- Iterate elements
            FOR elem IN SELECT * FROM jsonb_array_elements(scale)
            LOOP
                IF (elem->>'min_qty') IS NULL OR (elem->>'discount_pct') IS NULL THEN
                     RAISE EXCEPTION 'Discount items must have min_qty and discount_pct';
                END IF;
                
                IF (elem->>'min_qty')::int < 0 THEN
                     RAISE EXCEPTION 'min_qty must be positive';
                END IF;

                IF (elem->>'discount_pct')::numeric < 0 OR (elem->>'discount_pct')::numeric > 100 THEN
                     RAISE EXCEPTION 'discount_pct must be between 0 and 100';
                END IF;
            END LOOP;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_descuentos ON "CRM_ListaDePrecios";

CREATE TRIGGER trg_validate_descuentos
BEFORE INSERT OR UPDATE ON "CRM_ListaDePrecios"
FOR EACH ROW EXECUTE FUNCTION validate_descuentos_volumen();

COMMIT;
