-- Respaldo de actividades eliminadas definitivamente (copia completa de la fila en jsonb).
-- Restaurar una actividad:
--   INSERT INTO public."CRM_Actividades"
--   SELECT (jsonb_populate_record(NULL::public."CRM_Actividades", data)).*
--   FROM public."CRM_Backup_Actividades_Eliminadas" WHERE id_original = '<uuid>';
CREATE TABLE IF NOT EXISTS public."CRM_Backup_Actividades_Eliminadas" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_original uuid NOT NULL,
    user_id uuid,
    data jsonb NOT NULL,
    motivo text NOT NULL,
    eliminado_en timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_act_elim_id_original
    ON public."CRM_Backup_Actividades_Eliminadas" (id_original);

-- Solo accesible con service role (sin politicas para usuarios de la app).
ALTER TABLE public."CRM_Backup_Actividades_Eliminadas" ENABLE ROW LEVEL SECURITY;

