# Notificaciones

Sistema de notificaciones basado en **reglas configurables**
(`20260212_create_notification_system.sql`), gestionado en
`/configuracion/notificaciones` y mostrado en la campana del TopBar
(`components/layout/Notifications.tsx`).

## Reglas

Cada regla define: nombre, **tipo de evento**, parámetros, **destinatarios**
(vendedor asignado y/o coordinador — ver [[roles-y-permisos]]) y **canales** de entrega.

- Canal implementado: **Aplicación (campana)** ✅
- Pendientes: Correo electrónico ⏳ y Microsoft Teams ⏳

## Actividades vencidas (`ACTIVITY_OVERDUE`)

Tipo de evento principal documentado: notifica cuando una [[actividades|actividad]] no se
completó N días después de su vencimiento (N configurable, 0 = el mismo día).

- La evaluación corre en la Edge Function `check-overdue-activities` (Supabase),
  programada por cron (configuración en `docs/CONFIGURACION_CRON_NOTIFICACIONES.md`).

## Implementación

- UI de reglas: `components/notifications/RuleForm.tsx` / `RuleList.tsx`.
- Cliente: `lib/hooks/useNotifications.ts`, `lib/services/notifications.ts`,
  `lib/types/notifications.ts`.

## Fuentes

- `supabase/migrations/20260212_create_notification_system.sql`
- `supabase/functions/check-overdue-activities/index.ts`
- `docs/NOTIFICACIONES_ACTIVIDADES_VENCIDAS.md`, `docs/CONFIGURACION_CRON_NOTIFICACIONES.md`
