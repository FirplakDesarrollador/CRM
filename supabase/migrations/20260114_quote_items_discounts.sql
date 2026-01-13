-- MIGRATION: QUOTE ITEMS PRICING COLUMNS
-- Description: Adds discount and final price columns to CRM_CotizacionItems for persistence and sync.

BEGIN;

ALTER TABLE "CRM_CotizacionItems" 
ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_discount_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_unit_price NUMERIC;

COMMENT ON COLUMN "CRM_CotizacionItems".discount_pct IS 'Manual discount percentage applied by the salesperson.';
COMMENT ON COLUMN "CRM_CotizacionItems".max_discount_pct IS 'Maximum discount limit based on volume at the time of calculation (snapshot).';
COMMENT ON COLUMN "CRM_CotizacionItems".final_unit_price IS 'Unit price after applying the discount (snapshot).';

-- Optionally update existing records to have final_unit_price = precio_unitario if null
UPDATE "CRM_CotizacionItems" 
SET final_unit_price = precio_unitario 
WHERE final_unit_price IS NULL;

COMMIT;
