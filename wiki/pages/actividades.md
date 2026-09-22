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
- **Prioridad:** Campo `prioridad` ('Baja', 'Media', 'Alta', por defecto 'Media') soportado en `CRM_Actividades`, sincronizado en Supabase y Dexie (`20260922000000_add_prioridad_to_activities.sql`).
- **Base de datos local Dexie (v15):** Indexación de `account_id` en `activities` (`'id, opportunity_id, account_id, user_id, fecha_inicio, tipo_actividad'`) para soporte de búsquedas reactivas por cuenta y sincronización sin SchemaError.
- **Soft-delete:** `is_deleted` (`20260127_add_is_deleted_to_activities.sql`), filtrado de forma global en `useActivities` y en las vistas del módulo.
- **Columnas Microsoft:** `20260218_add_activities_ms_columns.sql` añade campos para
  vincular actividades con eventos de calendario Outlook (ver [[integraciones]]).

## Funcionalidad

- **Vistas del módulo (`/actividades`):**
  - **Todo:** Listado tabular agrupado con filtros globales por clasificación, fecha, estado y comercial.
  - **Agenda:** Vista cronológica de actividades por día con selector de fecha y panel lateral de detalle.
  - **Mes:** Vista de cuadrícula mensual con conteo de actividades por día, tooltip contextual con indicador `group/day` y apertura directa del modal de edición sin cambiar la vista activa gracias a `e.stopPropagation()`.
- Creación rápida vía `CreateActivityModal` desde varios módulos (también desde tiendas
  con `CreateStoreActivityModal`). La creación se estructura como un Wizard de 3 pasos (Tipo & Asunto, Clasificación & Fechas, Detalles).
- **Validaciones y obligatoriedad de campos:**
  - `clasificacion_id`: Obligatorio.
  - `fecha_inicio`: Obligatorio únicamente para tareas (Fecha de Vencimiento). Opcional para eventos.
  - `subclasificacion_id`: Opcional en todos los casos.
  - `asunto`: Se autogenera automáticamente si el usuario lo deja vacío con el formato `[Clasificación] - [Oportunidad o Cuenta]`.
- En edición, se eliminan los botones de guardado manual y se implementa guardado automático (auto-save) debounced (1.5 segundos) con indicador visual (`AutoSaveIndicator`) integrado vía `useFormAutoSave`.
  - **Fechas no destructivas:** En modo edición, `fecha_fin` no se sobreescribe en el montaje inicial; solo se recalcula si el usuario modifica activamente `fecha_inicio` o el `tipo_actividad`.
  - **Edición de actividades pasadas:** Los selectores `DateTimePicker` deshabilitan la restricción `minDate={new Date()}` en modo edición, permitiendo consultar y reprogramar actividades vencidas.
  - **Reasignación y asistentes persistentes:** El selector de reasignación (`reassignUserId` para ADMIN/COORDINADOR) usa `SearchableSelect` con búsqueda por nombre y correo, y junto a la lista de colaboradores/invitados (`attendees` en `_sync_metadata`) persiste inmediatamente invocando `updateActivity` en sus respectivos handlers.
  - **Reuniones Teams:** Toggle interactivo para eventos que vincula automáticamente el enlace de Microsoft Teams al sincronizar con Calendar.
- Vencimiento: las actividades no completadas después de su fecha generan
  [[notificaciones]] de tipo `ACTIVITY_OVERDUE` (Edge Function
  `check-overdue-activities`, ejecutada por cron).
- Visibilidad por rol: VENDEDOR solo las propias; COORDINADOR/ADMIN todas
  (ver [[roles-y-permisos]]; RLS ajustado en `20260428_fix_activities_rls`).

## Notas operativas

- El wizard de creacion de `CreateActivityModal` protege el submit final con `ACTIVITY_WIZARD_LAST_STEP`: solo crea desde el ultimo paso y el boton final queda deshabilitado brevemente al entrar a "Detalles".
- La ruta dev-only `/e2e/activities-wizard` monta el modal sin login y precarga una clasificacion local para probar que un doble clic en "Siguiente" no cree la actividad antes del ultimo paso.
- El checklist de Planner en tareas vive fuera de `react-hook-form`, por lo que tiene autosave propio: guarda `checklist` en `_sync_metadata`, lo encola para Supabase/Dexie mediante `useActivities.updateActivity` y manda PATCH a `/api/microsoft/planner/tasks/[taskId]`. Si el PATCH falla, marca `pending_planner_update` para reintento desde `SyncEngine`.
- **Colaboradores e invitados (Tenant Microsoft)**: En el paso 3 ("Detalles"), el modal busca usuarios en el tenant Microsoft a través de `/api/microsoft/users`. La búsqueda consulta prioritariamente Azure Active Directory (`/users?$search=...`) con header `ConsistencyLevel: eventual`, y encadena respaldos secuenciales (`/users?$filter=...`, People Search API y `/me/people`). Si la cuenta no está conectada o la API remota no arroja resultados, cuenta con un fallback transparente sobre `CRM_Usuarios` para garantizar disponibilidad de colaboradores corporativos.
- **Prevención de duplicados (Debounce por doble clic)**: El hook `useActivities.ts` implementa una caché en memoria a corto plazo (5 segundos) de la última actividad creada (`lastCreatedActivity`). Si se intenta crear una actividad con datos clave idénticos dentro de este intervalo, se intercepta la llamada, se advierte en consola y se retorna el ID anterior sin insertar un nuevo registro, evitando duplicados en Dexie y Supabase.

## Fuentes

- `app/actividades/page.tsx`, `components/activities/CreateActivityModal.tsx`
- `app/e2e/activities-wizard/`, `app/e2e/activities-checklist/`, `e2e/create_activity_wizard.spec.ts`, `e2e/activity_checklist_autosave.spec.ts`
- `lib/db.ts`, `lib/hooks/useActivities.ts`, `useActivityClassifications.ts`
- `supabase/migrations/20260922000000_add_prioridad_to_activities.sql`
- `supabase/functions/check-overdue-activities/`
- `docs/NOTIFICACIONES_ACTIVIDADES_VENCIDAS.md`

