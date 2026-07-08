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
  con `CreateStoreActivityModal`).
- Vencimiento: las actividades no completadas después de su fecha generan
  [[notificaciones]] de tipo `ACTIVITY_OVERDUE` (Edge Function
  `check-overdue-activities`, ejecutada por cron).
- Visibilidad por rol: VENDEDOR solo las propias; COORDINADOR/ADMIN todas
  (ver [[roles-y-permisos]]; RLS ajustado en `20260428_fix_activities_rls`).

## Fuentes

- `app/actividades/page.tsx`, `components/activities/CreateActivityModal.tsx`
- `lib/hooks/useActivities.ts`, `useActivitiesServer.ts`, `useActivityClassifications.ts`
- `supabase/functions/check-overdue-activities/`
- `docs/NOTIFICACIONES_ACTIVIDADES_VENCIDAS.md`
