-- Propagate account reassignments to every linked, non-deleted opportunity.
-- The previous account owner remains on each opportunity as a 50% collaborator.

BEGIN;

-- These columns are used by the offline sync engine when collaborators are edited.
ALTER TABLE "CRM_Oportunidades_Colaboradores"
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS _sync_metadata JSONB DEFAULT '{}'::jsonb;

-- Preserve one active row per collaborator/opportunity before enforcing uniqueness.
WITH ranked_collaborators AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY oportunidad_id, usuario_id
            ORDER BY
                CASE WHEN is_deleted IS TRUE THEN 1 ELSE 0 END,
                created_at,
                id
        ) AS row_number
    FROM "CRM_Oportunidades_Colaboradores"
)
UPDATE "CRM_Oportunidades_Colaboradores" collaborator
SET
    is_deleted = TRUE,
    updated_at = NOW()
FROM ranked_collaborators ranked
WHERE collaborator.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_opportunity_collaborator
    ON "CRM_Oportunidades_Colaboradores" (oportunidad_id, usuario_id)
    WHERE is_deleted IS NOT TRUE;

CREATE OR REPLACE FUNCTION propagate_account_owner_to_opportunities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    opportunity_record RECORD;
    collaborator_id UUID;
    actor_id UUID;
BEGIN
    IF OLD.owner_user_id IS NOT DISTINCT FROM NEW.owner_user_id
       OR NEW.owner_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    actor_id := COALESCE(auth.uid(), NEW.created_by);

    FOR opportunity_record IN
        SELECT id
        FROM "CRM_Oportunidades"
        WHERE account_id = NEW.id
          AND is_deleted IS NOT TRUE
        FOR UPDATE
    LOOP
        UPDATE "CRM_Oportunidades"
        SET
            owner_user_id = NEW.owner_user_id,
            updated_at = NOW(),
            updated_by = actor_id
        WHERE id = opportunity_record.id;

        IF OLD.owner_user_id IS NULL
           OR OLD.owner_user_id = NEW.owner_user_id THEN
            CONTINUE;
        END IF;

        collaborator_id := NULL;

        SELECT id
        INTO collaborator_id
        FROM "CRM_Oportunidades_Colaboradores"
        WHERE oportunidad_id = opportunity_record.id
          AND usuario_id = OLD.owner_user_id
        ORDER BY
            CASE WHEN is_deleted IS TRUE THEN 1 ELSE 0 END,
            created_at,
            id
        LIMIT 1
        FOR UPDATE;

        IF collaborator_id IS NULL THEN
            INSERT INTO "CRM_Oportunidades_Colaboradores" (
                oportunidad_id,
                usuario_id,
                porcentaje,
                rol,
                is_deleted,
                created_by,
                updated_by,
                updated_at
            ) VALUES (
                opportunity_record.id,
                OLD.owner_user_id,
                50,
                'COLABORADOR',
                FALSE,
                actor_id,
                actor_id,
                NOW()
            );
        ELSE
            UPDATE "CRM_Oportunidades_Colaboradores"
            SET
                porcentaje = 50,
                rol = 'COLABORADOR',
                is_deleted = FALSE,
                updated_by = actor_id,
                updated_at = NOW()
            WHERE id = collaborator_id;

            -- Defensive cleanup for databases that already contained duplicates.
            UPDATE "CRM_Oportunidades_Colaboradores"
            SET
                is_deleted = TRUE,
                updated_by = actor_id,
                updated_at = NOW()
            WHERE oportunidad_id = opportunity_record.id
              AND usuario_id = OLD.owner_user_id
              AND id <> collaborator_id
              AND is_deleted IS NOT TRUE;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_account_owner_to_opportunities ON "CRM_Cuentas";
CREATE TRIGGER trg_propagate_account_owner_to_opportunities
AFTER UPDATE OF owner_user_id ON "CRM_Cuentas"
FOR EACH ROW
WHEN (OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id)
EXECUTE FUNCTION propagate_account_owner_to_opportunities();

-- Replace permissive collaborator writes with the requested authorization model.
DROP POLICY IF EXISTS "Allow write access to authenticated users" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Allow authenticated users to update" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Allow authenticated users to delete" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Authorized users insert opportunity collaborators" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Authorized users update opportunity collaborators" ON "CRM_Oportunidades_Colaboradores";
DROP POLICY IF EXISTS "Authorized users delete opportunity collaborators" ON "CRM_Oportunidades_Colaboradores";

CREATE OR REPLACE FUNCTION can_edit_opportunity_collaborators(target_opportunity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM "CRM_Oportunidades" opportunity
        WHERE opportunity.id = target_opportunity_id
          AND opportunity.is_deleted IS NOT TRUE
          AND (
              opportunity.owner_user_id = auth.uid()
              OR is_coordinator_of_owner(opportunity.owner_user_id)
              OR EXISTS (
                  SELECT 1
                  FROM "CRM_Usuarios" current_user_record
                  WHERE current_user_record.id = auth.uid()
                    AND current_user_record.role = 'ADMIN'
                    AND current_user_record.is_active = TRUE
              )
          )
    );
$$;

CREATE OR REPLACE FUNCTION enforce_opportunity_collaborator_editor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_opportunity_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    target_opportunity_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.oportunidad_id
        ELSE NEW.oportunidad_id
    END;

    IF NOT can_edit_opportunity_collaborators(target_opportunity_id) THEN
        RAISE EXCEPTION 'No tiene permiso para editar los colaboradores de esta oportunidad'
            USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_opportunity_collaborator_editor
ON "CRM_Oportunidades_Colaboradores";
CREATE TRIGGER trg_enforce_opportunity_collaborator_editor
BEFORE INSERT OR UPDATE OR DELETE ON "CRM_Oportunidades_Colaboradores"
FOR EACH ROW
EXECUTE FUNCTION enforce_opportunity_collaborator_editor();

CREATE POLICY "Authorized users insert opportunity collaborators"
ON "CRM_Oportunidades_Colaboradores"
FOR INSERT
TO authenticated
WITH CHECK (can_edit_opportunity_collaborators(oportunidad_id));

CREATE POLICY "Authorized users update opportunity collaborators"
ON "CRM_Oportunidades_Colaboradores"
FOR UPDATE
TO authenticated
USING (can_edit_opportunity_collaborators(oportunidad_id))
WITH CHECK (can_edit_opportunity_collaborators(oportunidad_id));

CREATE POLICY "Authorized users delete opportunity collaborators"
ON "CRM_Oportunidades_Colaboradores"
FOR DELETE
TO authenticated
USING (can_edit_opportunity_collaborators(oportunidad_id));

COMMIT;
