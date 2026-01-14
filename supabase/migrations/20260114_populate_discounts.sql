-- MIGRATION: POPULATE GLOBAL VOLUME DISCOUNTS
-- Description: Applies a 15% max discount for 1-5 units and 70% for 6+ units across all channels.

BEGIN;

UPDATE "CRM_ListaDePrecios"
SET descuentos_volumen = jsonb_build_object(
    'OBRAS_NAC', jsonb_build_array(
        json_build_object('min_qty', 1, 'discount_pct', 15),
        json_build_object('min_qty', 6, 'discount_pct', 70)
    ),
    'OBRAS_INT', jsonb_build_array(
        json_build_object('min_qty', 1, 'discount_pct', 15),
        json_build_object('min_qty', 6, 'discount_pct', 70)
    ),
    'DIST_NAC', jsonb_build_array(
        json_build_object('min_qty', 1, 'discount_pct', 15),
        json_build_object('min_qty', 6, 'discount_pct', 70)
    ),
    'DIST_INT', jsonb_build_array(
        json_build_object('min_qty', 1, 'discount_pct', 15),
        json_build_object('min_qty', 6, 'discount_pct', 70)
    ),
    'PROPIO', jsonb_build_array(
        json_build_object('min_qty', 1, 'discount_pct', 15),
        json_build_object('min_qty', 6, 'discount_pct', 70)
    )
);

COMMIT;
