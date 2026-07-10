# Actividades

Las actividades (`/actividades`, tabla `CRM_Actividades`) son las tareas, llamadas,
visitas y eventos del equipo comercial. Pueden asociarse a [[oportunidades]] y a
[[cuentas]] (`20260309_add_account_to_activities`).

## Modelo

- **Tipos:** `CRM_TiposActividad` + campo `activity_type`
  (`20260114_add_activity_type.sql`).
- **Clasificación y subclasificación:** sistema configurable
  (`20260127_activity_classifications.sql`, gestionado desde
  `ActivityClassificationManager` en Configuración; hook
  `useActivityClassifications`).
- **Soft-delete:** `is_deleted` (`20260127_add_is_deleted_to_activities.sql`).
- **Columnas Microsoft:** `20260218_add_activities_ms_columns.sql` añade campos para
  vincular actividades con eventos de calendario Outlook (ver [[integraciones]]).

## Funcionalidad

- Creación rápida vía `CreateActivityModal` desde varios módulos (también desde tiendas
  con `CreateStoreActivityModal`). La creación se estructura como un Wizard de 3 pasos (Tipo & Asunto, Clasificación & Fechas, Detalles).
- En edición, se eliminan los botones de guardado manual y se implementa guardado automático (auto-save) debounced (1.5 segundos) con indicador visual (`AutoSaveIndicator`) integrado vía `useFormAutoSave`.
- Vencimiento: las actividades no completadas después de su fecha generan
  [[notificaciones]] de tipo `ACTIVITY_OVERDUE` (Edge Function
  `check-overdue-activities`, ejecutada por cron).
- Visibilidad por rol: VENDEDOR solo las propias; COORDINADOR/ADMIN todas
  (ver [[roles-y-permisos]]; RLS ajustado en `20260428_fix_activities_rls`).

## Notas operativas

- El wizard de creacion de `CreateActivityModal` protege el submit final con `ACTIVITY_WIZARD_LAST_STEP`: solo crea desde el ultimo paso y el boton final queda deshabilitado brevemente al entrar a "Detalles".
- La ruta dev-only `/e2e/activities-wizard` monta el modal sin login y precarga una clasificacion local para probar que un doble clic en "Siguiente" no cree la actividad antes del ultimo paso.
- El checklist de Planner en tareas vive fuera de `react-hook-form`, por lo que tiene autosave propio: guarda `checklist` en `_sync_metadata`, lo encola para Supabase/Dexie mediante `useActivities.updateActivity` y manda PATCH a `/api/microsoft/planner/tasks/[taskId]`. Si el PATCH falla, marca `pending_planner_update` para reintento desde `SyncEngine`.

## Fuentes

- `app/actividades/page.tsx`, `components/activities/CreateActivityModal.tsx`
- `app/e2e/activities-wizard/`, `app/e2e/activities-checklist/`, `e2e/create_activity_wizard.spec.ts`, `e2e/activity_checklist_autosave.spec.ts`
- `lib/hooks/useActivities.ts`, `useActivitiesServer.ts`, `useActivityClassifications.ts`
- `supabase/functions/check-overdue-activities/`
- `docs/NOTIFICACIONES_ACTIVIDADES_VENCIDAS.md`
