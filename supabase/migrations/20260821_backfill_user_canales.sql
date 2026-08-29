-- Backfill Canal_Venta y canales en CRM_Usuarios basado en CRM_Canales_Vendedores y asignacion de cuentas (CRM_Cuentas)
ALTER TABLE "CRM_Usuarios" 
  ADD COLUMN IF NOT EXISTS "canales" TEXT[] DEFAULT '{}';

WITH primary_channel AS (
    SELECT DISTINCT ON (c.owner_user_id)
        c.owner_user_id AS user_id,
        c.canal_id
    FROM "CRM_Cuentas" c
    WHERE c.is_deleted IS NOT TRUE AND c.owner_user_id IS NOT NULL AND c.canal_id IS NOT NULL
    GROUP BY c.owner_user_id, c.canal_id
    ORDER BY c.owner_user_id, COUNT(*) DESC
),
canales_vendedores_channel AS (
    SELECT DISTINCT ON (vendedor_id)
        vendedor_id AS user_id,
        canal_id
    FROM "CRM_Canales_Vendedores"
    WHERE canal_id IS NOT NULL
    ORDER BY vendedor_id, created_at DESC
),
inferred_channels AS (
    SELECT 
        u.id,
        COALESCE(cvc.canal_id, pc.canal_id) AS canal_id
    FROM "CRM_Usuarios" u
    LEFT JOIN canales_vendedores_channel cvc ON u.id = cvc.user_id
    LEFT JOIN primary_channel pc ON u.id = pc.user_id
    WHERE COALESCE(cvc.canal_id, pc.canal_id) IS NOT NULL
)
UPDATE "CRM_Usuarios" u
SET "Canal_Venta" = ic.canal_id,
    "canales" = ARRAY[ic.canal_id],
    updated_at = NOW()
FROM inferred_channels ic
WHERE u.id = ic.id;
