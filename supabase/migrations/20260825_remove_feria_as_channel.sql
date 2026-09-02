-- Migración para eliminar el canal FERIA de CRM_Canales y mantener los 5 canales canónicos.
-- Las ferias continúan operando como origen de oportunidad y mediante precio_feria.

BEGIN;

-- 1. Reasignar cualquier cuenta existente con canal FERIA a Canal Propio (PROPIO)
UPDATE "CRM_Cuentas"
SET canal_id = 'PROPIO'
WHERE canal_id = 'FERIA';

-- 2. Limpiar 'FERIA' de los canales asignados a asesores/usuarios
UPDATE "CRM_Usuarios"
SET canales = array_remove(canales, 'FERIA')
WHERE 'FERIA' = ANY(canales);

-- 3. Reasignar o eliminar subclasificaciones asociadas al canal FERIA
-- Si ya existe 'Cliente de feria' en PROPIO se elimina el de FERIA, o se reasigna a PROPIO
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "CRM_Subclasificacion" WHERE nombre = 'Cliente de feria' AND canal_id = 'PROPIO'
    ) THEN
        DELETE FROM "CRM_Subclasificacion" WHERE canal_id = 'FERIA';
    ELSE
        UPDATE "CRM_Subclasificacion"
        SET canal_id = 'PROPIO'
        WHERE canal_id = 'FERIA';
    END IF;
END $$;

-- 4. Reasignar oportunidades que pudieran apuntar a fases del canal FERIA a su fase equivalente en PROPIO
UPDATE "CRM_Oportunidades" o
SET fase_id = pf.id
FROM "CRM_FasesOportunidad" ff
JOIN "CRM_FasesOportunidad" pf ON pf.canal_id = 'PROPIO' AND pf.nombre = ff.nombre
WHERE o.fase_id = ff.id AND ff.canal_id = 'FERIA';

-- 5. Eliminar fases del canal FERIA
DELETE FROM "CRM_FasesOportunidad"
WHERE canal_id = 'FERIA';

-- 6. Eliminar el registro FERIA de CRM_Canales
DELETE FROM "CRM_Canales"
WHERE id = 'FERIA';

-- 7. Asegurar que 'Feria' exista como origen de oportunidad disponible
INSERT INTO "CRM_OrigenesOportunidad" (nombre, is_active, is_default)
VALUES ('Feria', TRUE, FALSE)
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
