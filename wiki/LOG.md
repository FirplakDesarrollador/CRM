# LOG — Registro de Operaciones del Wiki

> Orden cronológico inverso (lo más reciente arriba). Una entrada por operación
> de ingest/lint significativa. Formato: fecha — operación — resumen.

## 2026-08-24 - Fix: Detección Temprana de Duplicados en /tiendas y Auto-curación de Snapshots en SyncEngine

- **Detección Temprana en Tiempo Real (`CreateStoreSaleForm.tsx`):** Monitoreo reactivo de `nit_base`, `telefono` y `email` contra Dexie y Supabase (con debounce). Si existe una cuenta coincidente, despliega tarjetas de advertencia con botón de acción rápida `⚡ Vincular` para autocompletar y proteger la cuenta existente con un solo clic.
- **Reasignación Profunda de `account_id` en Snapshots (`lib/sync.ts`):** `resolveDuplicateAccount()` ahora reasigna `account_id` dentro de todos los snapshots `_complete_snapshot_` en el outbox (`CRM_Contactos`, `CRM_Oportunidades`, `CRM_Cotizaciones`, `CRM_Actividades`), eliminando fallos en cascada por clave foránea `fk_crmcontactos_account`.
- **Auto-curación de Contactos (`healDuplicateContactPhone` & `healOrphanedContactAccount`):** Intercepción de errores `unique_active_contact_phone` y `fk_crmcontactos_account` en `SyncEngine.pushBatch` para sanear mutaciones huérfanas y desatascar la cola de sincronización.
- **Propagación de Contacto Personalizado (`useAccounts.ts`):** `createAccount` ahora recibe y aplica `initialContactData` diligenciado en el formulario en lugar de crear contactos genéricos.

## 2026-08-24 - Fix: Corrección de Flickering y Filtrado Estricto de Asesores por Canal/Zona en /tiendas

- **Eliminación de Bucles Cíclicos:** Se removieron los `useEffect`s pasivos de selección forzada y sincronización bidireccional en `CreateStoreSaleForm.tsx` que provocaban parpadeo (flickering) al interactuar con el selector de departamentos.
- **Opción por Defecto "Seleccione un asesor...":** Se configuró `asesor_id: ""` como valor inicial/default en el formulario y se mantiene la validación requerida de Zod antes de guardar.
- **Deselección Automática en Cascada:** Al cambiar de País, Departamento o Canal de Venta, el selector de asesor se limpia automáticamente (`setValue("asesor_id", "")`).
- **Filtrado Estricto por Canal y Departamento:** Se corrigió la condición de validación en `filteredAdvisors`: los asesores ahora deben tener **obligatoriamente** el canal asignado y, en canales zonales (Obras / Distribución), el departamento seleccionado debe estar dentro de sus zonas asignadas (ej. al seleccionar Obras Nacional + Antioquia únicamente aparece la asesora de zona correspondiente).

## 2026-08-21 - Lint: Wiki posterior al endurecimiento del SyncEngine

- Estructura: `listed=15`, `pages=15`, `missing=0`, `orphans=0`.
- Enlaces: `broken=0`; no se introdujeron enlaces `[[...]]` sin destino.
- Fuentes: las 15 páginas conservan su sección `## Fuentes`.
- Contraste contra código: se verificaron los estados y tiempos del Outbox, la frontera `syncUpperBound`, los cursores `syncCursors`, la paginación de 1.000 filas, el TTL de catálogos, `CRM_PedidoItems.updated_at`, la telemetría `syncRuns` y el contrato de la migración contra `lib/sync.ts`, `lib/sync-runtime.ts`, `lib/db.ts` y `supabase/migrations/20260821230051_harden_sync_engine.sql`.
- Correcciones aplicadas: se eliminaron de `sincronizacion-offline.md` las afirmaciones obsoletas sobre cursor exclusivo en localStorage, reintentos sin programación durable y descarte de mutaciones agotadas.

## 2026-08-21 - Ingest: Endurecimiento integral del motor de sincronización

- **Outbox recuperable:** se documentaron compactación transaccional al encolar, leases multipestaña, backoff con `next_attempt_at`, estado `DEAD_LETTER`, recuperación manual y reactivación mediante una nueva edición.
- **Push/pull y cursores:** se sustituyó la descripción obsoleta del cursor exclusivo en localStorage por cursores durables en Dexie, aislados por usuario, una frontera `syncUpperBound` y confirmación únicamente tras un pull completo exitoso.
- **Paginación y catálogos:** se registró la paginación explícita de PostgREST, los límites de bootstrap, el TTL de 24 horas para catálogos y los refrescos dirigidos.
- **RPC y PedidoItems:** se documentó la migración `20260821230051_harden_sync_engine.sql`, el uso de `SECURITY INVOKER`, validación de identidad/lista blanca, correlación por `mutation_id` y `updated_at` para `CRM_PedidoItems`.
- **Observabilidad y recuperación:** se añadieron `syncRuns`, diagnóstico desde `/configuracion`, preservación completa del Outbox en `cleanResync()` y la validación automatizada del subsistema.
- **Validación ejecutada:** typecheck enfocado, 11 pruebas y build de producción aprobados; migración probada en PostgreSQL 17 aislado. La migración aún requiere aplicación y validación en Supabase antes del despliegue del cliente.
- Páginas actualizadas: `wiki/pages/sincronizacion-offline.md`, `wiki/INDEX.md`, `wiki/LOG.md`. Los diagnósticos individuales permanecen en `bugs-knowhow.md` según `wiki/SCHEMA.md`.

## 2026-08-21 - Ingest: Desacoplamiento Push / Pull y Deduplicación Universal de Outbox en SyncEngine
- **Desacoplamiento Push / Pull (`triggerPush`):** Las mutaciones locales (`queueMutation`) ahora disparan exclusivamente `triggerPush()`, enviando inmediatamente los cambios locales vía RPC sin ejecutar descargas masivas de tablas.
- **Persistencia de `lastSyncTime` en Zustand:** Se aplicó el middleware `persist` en `useSyncStore` para guardar `lastSyncTime` en `localStorage`, evitando que en cada recarga se dispare una descarga inicial completa de 3,000 registros por tabla.
- **Deduplicación Universal en `resetStuckItems()`:** Purga automática de snapshots y mutaciones redundantes agrupadas por entidad en `db.outbox`.
- Páginas actualizadas: `wiki/pages/sincronizacion-offline.md`, `wiki/LOG.md`.

## 2026-08-21 - Ingest: Origen por Defecto Único en /configuracion y Selección Automática en /tiendas

- Se creó y ejecutó la migración `20260821_add_is_default_to_opportunity_origins.sql` agregando `is_default BOOLEAN NOT NULL DEFAULT FALSE` con índice único condicional `uq_crm_origenes_is_default` en `CRM_OrigenesOportunidad`.
- **Módulo `/configuracion` (`OpportunityOriginsManager.tsx`):** Se agregó toggle de radio exclusivo "Default" por origen, permitiendo marcar solo uno como predeterminado.
- **Hook `useOpportunityOrigins.ts`:** Se extendió la interfaz `OpportunityOrigin` y consulta con el campo `is_default`.
- **Módulo `/tiendas` (`CreateStoreSaleForm.tsx`):** Se actualizó el efecto de selección inicial para asignar prioritariamente el origen configurado como `is_default`.
- Páginas actualizadas: `wiki/LOG.md`.

## 2026-08-21 - Ingest: Backfill de origen_cuenta desde Oportunidades y Trigger Automático

- Se creó y ejecutó la migración `20260821_backfill_account_origin_from_opportunities.sql`.
- **Backfill histórico:** Se poblaron **2,548 cuentas** tomando el origen de su oportunidad más reciente.
- **Trigger automático:** Se implementó `trg_sync_opportunity_origin_to_account` en `CRM_Oportunidades` para que cualquier oportunidad nueva o actualizada con origen propague automáticamente el valor a `CRM_Cuentas.origen_cuenta` si la cuenta no lo tiene aún.
- Páginas actualizadas: `wiki/pages/cuentas.md`, `wiki/LOG.md`.

## 2026-08-21 - Ingest: Propagación de origen_cuenta en Creación de Cuentas desde /tiendas

- Se actualizó `CreateStoreSaleForm.tsx` en el módulo `/tiendas` para que al crear una nueva cuenta se persista automáticamente `origen_cuenta` con el valor seleccionado en `origen_oportunidad` (ej. visita, referido, feria, etc.).
- Páginas actualizadas: `wiki/LOG.md`.

## 2026-08-21 - Ingest: Asignación de Canales de Venta a Usuarios y Filtrado en Formulario /tiendas

- **Columna `canales` en `CRM_Usuarios`:** Se creó la migración `20260821_add_user_channels.sql` agregando la columna `canales TEXT[] DEFAULT '{}'` para permitir la asignación de uno o múltiples canales de venta a cada usuario/asesor.
- **Módulo `/usuarios`:**
  - Se incorporó selector múltiple `MultiSelect` de canales de venta en `UserForm.tsx` con las opciones de `SALES_CHANNELS` (Canal Propio, Distribución Nacional, Distribución Internacional, Obras Nacional / Constructor, Obras Internacional, Feria).
  - Se añadieron badges informativos de canales asignados en la tabla de usuarios de `UserList.tsx`.
  - Se actualizó el hook `useUsers.ts` (`User`, `CreateUserData`, `UpdateUserData`) con manejo resiliente ante variaciones de esquema en Supabase.
- **Módulo `/tiendas` (`CreateStoreSaleForm.tsx`):**
  - Se extendió el hook de filtrado `filteredAdvisors` para validar que el asesor tenga asignado el canal de venta seleccionado (`watch("canal_id")`).
  - Al cambiar de canal en el formulario, se reevalúan los asesores disponibles y se auto-selecciona el primer asesor válido para la combinación de país, departamento y canal.
  - Se agregó mensaje informativo si ningún asesor coincide con los criterios seleccionados.
- Páginas actualizadas: `wiki/pages/canales-de-venta.md`, `wiki/pages/modelo-de-datos.md`, `wiki/LOG.md`.

## 2026-08-21 - Ingest: Arquitectura Local-First Pura, Pull Segmentado y Re-Sync Limpio

- **Local-First en `useAccounts.ts`:** Se eliminaron las llamadas directas HTTP de `deleteAccount`, delegando el borrado en cascada a Dexie local y encolando mutaciones de soft-delete en el Outbox (100% offline).
- **Pull Segmentado por Asesor en `lib/sync.ts`:** `pullChanges` descarga prioritariamente el 100% de las cuentas del asesor activo (`owner_user_id` y `created_by`) antes de limitar el histórico general a 3,000 registros, garantizando que ninguna cuenta propia quede fuera del caché local.
- **Herramienta de Re-sincronización Limpia (`cleanResync`):** Nuevo método en `SyncEngine` y botón en `/configuracion` que vacía las tablas de caché de Dexie y re-descarga todo desde Supabase conservando de forma segura cualquier mutación pendiente en el Outbox.
- **Diagnóstico de Almacenamiento en `/configuracion`:** Visualización en tiempo real del almacenamiento IndexedDB usado vía `navigator.storage.estimate()`.
- **Carga Local-First de Segmentos en `CreateOpportunityWizard.tsx`:** Uso de `useLiveQuery` sobre `db.segments` con fallback de red.
- Páginas actualizadas: `wiki/pages/sincronizacion-offline.md`, `wiki/LOG.md`.

## 2026-08-21 - Ingest: Optimización de Rendimiento y Compactación en SyncEngine

- Se optimizó el motor de sincronización (`SyncEngine` en `lib/sync.ts`):
  - **Compactación Retroactiva en `resetStuckItems`:** Agrupa y compacta colas fragmentadas de múltiples campos por cuenta a 1 solo `_complete_snapshot_`, reduciendo el volumen de ítems hasta en un 94% al iniciar el sync.
  - **Auto-curación en Modo Snapshot:** Al re-encolar cuentas locales faltantes para oportunidades, se encolan directamente en modo snapshot atómico.
  - **Bucle de Lotes Continuo en `pushChanges`:** Procesa lotes consecutivos de hasta 500 ítems con micro-pausas (`yield()`) en lugar de terminar tras un único lote.
  - **Desacoplamiento de Backoff:** Continuación inmediata (100ms) cuando existen ítems saludables `PENDING`, reservando las pausas de retardo exponencial únicamente para fallos `FAILED`.
  - **Sanitización de `nit` Legacy:** Validación de límite de 32-bit (`<= 2147483647`) en `CRM_Cuentas.nit` para evitar fallos de casteo int4 en PostgreSQL.
- Páginas actualizadas: `wiki/pages/sincronizacion-offline.md`, `wiki/LOG.md`, `bugs-knowhow.md` (Bug ID: 20260821-01).

## 2026-08-20 - Ingest: Autocompletado, Búsqueda Flexible, Enmascaramiento y Sección de Contacto en /tiendas

- Se integró búsqueda interactiva de cuentas existentes en el campo "Nombre de la Cuenta / Cliente" del formulario de creación rápida en `/tiendas` (`CreateStoreSaleForm.tsx`).
- Se implementó la utilidad `matchesSearchTokens` en `lib/utils.ts` permitiendo búsquedas multi-término independientes del orden, mayúsculas y acentos.
- Al seleccionar una cuenta existente:
  - Se completan e inhabilitan (bloquean) los 10 campos de datos del cliente: `nit_base`, `telefono`, `email`, `canal_id`, `subclasificacion_id`, `pais_id`, `departamento_id`, `ciudad_id`, `asesor_id` y `direccion`.
  - Los campos sensibles `nit_base`, `telefono` y `email` se enmascaran visualmente con `*****`.
  - Aparece una **sección comprimida de Contacto** (acordeón colapsable) inmediatamente después de los datos del cliente, permitiendo registrar un nuevo contacto (`nombre`, `cargo`, `email`, `telefono`, `comentarios`) asociado a la cuenta existente seleccionada.
  - Se enlaza la oportunidad, actividad y nuevo contacto directamente a la cuenta existente (`account_id`) sin sobreescribir datos sensibles en la base de datos.
- Si se desvincula o se borra el nombre del cliente, el formulario vuelve a su estado por defecto editable y oculta/limpia la sección de contacto.
- Se aseguró que `createContact` en `lib/hooks/useContacts.ts` persista el campo opcional `comentarios`.
- Páginas actualizadas: `wiki/LOG.md`.

## 2026-08-20 - Ingest: Columna origen_cuenta en CRM_Cuentas y Wizard de Creación

- Se creó la migración `20260820_add_origen_cuenta.sql` agregando la columna `origen_cuenta TEXT` en `CRM_Cuentas`.
- Se integró el campo opcional de texto "Origen de la Cuenta" en el paso 2 (Ubicación y Contacto) del wizard de creación `CreateAccountWizard.tsx`.
- Se actualizó el formulario de edición `AccountForm.tsx`, la interfaz `LocalCuenta` en `lib/db.ts` y el tipo `AccountServer` en `useAccountsServer.ts`.
- Páginas actualizadas: `wiki/pages/cuentas.md`, `wiki/LOG.md`.

## 2026-08-12 - Ingest: Valores por Defecto y Sección Colapsable en Actividad Programada de /tiendas

- Se actualizó el formulario `CreateStoreSaleForm.tsx` del módulo `/tiendas` (Tiendas-Ferias).
- Se simplificó el campo de fecha reduciéndolo únicamente a **Fecha y Hora de Vencimiento** (eliminando `fecha_inicio`).
- Se configuró el valor por defecto de la fecha de vencimiento a 7 días posteriores a las 10:00 AM local.
- Se configuró la **Clasificación por defecto** seleccionando automáticamente "Llamada telefónica" al cargar las opciones.
- Se mantuvo la **Prioridad por defecto** en "Media".
- Se transformó la sección "Actividad Programada" en un acordeón colapsable (cerrado por defecto) que muestra un resumen visual y permite desplegar y editar la información según el usuario lo requiera.
- Páginas actualizadas: `wiki/LOG.md`.

## 2026-08-10 - Ingest: Filtrado de Asesor por País y Departamento en Formulario /tiendas

- Se agregaron las columnas `paises` y `departamentos` (arreglos `TEXT[]`) a la tabla `CRM_Usuarios` en Supabase (`20260810_add_user_country_department.sql`).
- Se incorporaron selectores `MultiSelect` en `UserForm.tsx` para permitir asignar múltiples países y departamentos a un vendedor.
- Se hizo obligatorio el campo `asesor_id` en el esquema del formulario del módulo `/tiendas` (`CreateStoreSaleForm.tsx`), trasladándolo a **Datos del Cliente**.
- Se implementaron los fallbacks asíncronos de catálogos geográficos (`displayCountries`) y un efecto reactivo que garantiza que Colombia (`'1'`) se seleccione por defecto automáticamente al cargar las opciones.
- Se actualizó el filtro de asesores en `CreateStoreSaleForm.tsx` con la regla estricta: un vendedor DEBE tener asignados explícitamente el país y el departamento para aparecer disponible en el desplegable. Si no tiene asignación, se excluye automáticamente.
- Páginas actualizadas: `wiki/pages/modelo-de-datos.md`, `wiki/LOG.md`.

## 2026-07-30 - Ingest: Precarga de campos por defecto en pedidos desde la Cuenta

- Se implementó la precarga automática de campos para la creación de nuevos pedidos parciales (`!pedidoUuid`) en el formulario `PedidoEditorForm` de `PedidosEditor.tsx`.
- Campos autocompletados desde `LocalCuenta` y `LocalContact` (vía Dexie y `useLiveQuery`): `cliente_final`, `nit_cliente_final`, `direccion_envio_factura`, `email_contacto`, `contacto_ventas`, `contacto_logistico`, `contacto_tesoreria` y `dir_envio_factura_tipo` (default "OFICINA").
- Páginas actualizadas: `wiki/pages/cotizaciones-y-pedidos.md`, `wiki/LOG.md`.

## 2026-07-29 - Ingest: Campos Obligatorios para Guardar Pedidos en Cotizaciones

- Se definieron e implementaron las validaciones obligatorias de los 9 campos solicitados para guardar pedidos (totales o parciales) dentro de `PedidosEditor.tsx`.
- Campos incluidos: `cierre_facturacion`, `fecha_facturacion`, `es_muestra`, `servicio_subida_hidromasaje`, `piso_entrega` (default 1), `medio_acceso` (Ascensor vs Escalera / `tiene_escaleras`), `verificacion_previa_firplak`, `direccion_envio_factura` y `dir_envio_factura_tipo` (Oficina / Tienda).
- Se ejecutó la migración SQL `supabase/migrations/20260729_required_order_fields.sql` mediante el MCP de Supabase para incorporar `verificacion_previa_firplak`, `direccion_envio_factura`, `cierre_facturacion` y `es_muestra` a las tablas `CRM_Cotizaciones` y `CRM_Pedidos`.
- Se actualizaron las interfaces de Dexie `LocalQuote` y `LocalPedido` en `lib/db.ts`.
- Páginas actualizadas: `wiki/pages/cotizaciones-y-pedidos.md`, `wiki/LOG.md`.

## 2026-07-24 - Catálogo: Toggle "Productos de feria"

- Se agregó un filtro tipo casilla / toggle "Productos de feria" en la vista de Catálogo (`app/catalogo/page.tsx`).
- Al activarse, filtra la lista para mostrar únicamente aquellos productos cuyo valor en la columna `precio_feria` sea mayor a cero (`precio_feria > 0`).

## 2026-07-24 - Informes: Filtros Avanzados Dinámicos por Entidad

- Se implementó un conjunto completo de filtros avanzados por entidad en el módulo de informes (`app/informes/page.tsx`).
- Oportunidades: Fase, Segmento, Origen, Rango de valor ($ min/max), Departamento y Ciudad.
- Cuentas: Nivel Premium (VIP vs Estándar), Departamento y Ciudad.
- Contactos: Cargo / Rol de decisión.
- Cotizaciones: Estado (DRAFT, SENT, WINNER, REJECTED, EXPIRED) y Rango de valor ($ min/max).
- Actividades: Rango de fechas de vencimiento (`fecha_fin`), Estado de cumplimiento (completadas vs pendientes), Tipo de actividad, Clasificación y Subclasificación.
- Proyección S&OP: Planta (PC, ALM, FVH), Familia de producto, Probabilidad mínima (%), Quincena y Tipo de registro (pedidos vs proyectado).
- Se añadió el botón de acción "Limpiar Filtros".
- Páginas actualizadas: `wiki/pages/dashboard-e-indicadores.md`.

## 2026-07-24 - Catálogo: Visualización Completa de Listas de Precios y Solución RLS

- Se actualizó el módulo de Catálogo (`app/catalogo/page.tsx`) para mostrar en una lista tabular todas las columnas de precio simultáneamente (PVP Propio, Base COP, Obras Nacional, Exportaciones, PVP Sin IVA y Precio Feria).
- Se incluyó la columna `precio_feria` en la plantilla de carga masiva CSV (`public/plantilla_precios.csv`) y en el hook `useProducts.ts`.
- Se creó la migración `supabase/migrations/20260724_fix_price_list_rls.sql` para corregir las políticas RLS y permitir la carga masiva mediante `admin_upsert_price_list`.

## 2026-07-16 - Tiendas-Ferias, Catálogo e Inventarios

- Tiendas se renombró a Tiendas-Ferias y ahora permite canal, subclasificación automática, origen configurable y venta con precio de feria.
- Se añadieron Catálogo (`/catalogo`) e Inventarios (`/inventarios`, solo ADMIN).
- El inventario se deriva de entradas, salidas y reservas; el trigger evita salidas o reservas sin disponibilidad y audita ediciones.
- Migración principal: `20260716_stores_fairs_catalog_inventory.sql`.


## 2026-07-16 - Ingest: Saneamiento y Prevención de Actividades Duplicadas

Saneamiento del historial de actividades y prevención de duplicados por doble clic en actividades.
- Causa: Actividades duplicadas exactas o muy cercanas en tiempo en `CRM_Actividades`.
- Saneamiento: Se ejecutó un script SQL en Supabase que eliminó 47 registros duplicados exactos o con diferencia menor a 15 minutos en el mismo día (conservando la primera de cada conjunto).
- Prevención: Se implementó un mecanismo de de-duplicación en el hook cliente `useActivities.ts` usando una caché en memoria a corto plazo (5 segundos) para `createActivity`. Si se intenta crear una actividad con los mismos datos clave de forma consecutiva en menos de 5 segundos, la llamada se bloquea y retorna el ID existente.
- Páginas actualizadas: `wiki/pages/actividades.md`.

## 2026-07-14 - Lint e Ingest: Ajuste en Filtro de Colaboración

Ejecución de verificación sobre el filtro de colaboración en oportunidades.
- Causa: El filtro original de "Colaboración" excluía las oportunidades donde el usuario activo era el propietario pero contaba con colaboradores.
- Cambio: Se modificó la lógica en `useOpportunitiesServer.ts` (tanto para DB online como para el motor offline Dexie) para incluir cualquier oportunidad compartida donde el usuario sea colaborador O sea el propietario y tenga colaboradores asignados.
- Estructura y enlaces: No hay páginas huérfanas ni enlaces rotos tras el cambio.
- Páginas actualizadas: `wiki/pages/oportunidades.md`.

## 2026-07-14 - Ingest: Prevención de Duplicados en Oportunidades

Implementación de un Trigger PL/pgSQL en base de datos para prevenir oportunidades clonadas.
- Causa: Se detectó la creación de múltiples oportunidades idénticas en el mismo microsegundo, lo cual inflaba las métricas.
- Cambio: Se creó la función `prevent_duplicate_oportunidades` y el trigger `trigger_prevent_duplicate_oportunidades` en `CRM_Oportunidades` que bloquea (lanza EXCEPTION) si se detecta una oportunidad con el mismo `account_id` y `nombre` creada hace menos de 10 segundos.
- Páginas actualizadas: `wiki/pages/oportunidades.md`.

## 2026-07-10 - Lint: Confirmacion de cambios de checklist Planner

Ejecucion solicitada del workflow `.agents/workflows/wiki-lint.md` sobre los cambios recientes.
- Estructura: `missing=0`, `orphans=0`; `wiki/INDEX.md` y `wiki/pages/` siguen consistentes.
- Enlaces: `broken=0`; no se detectaron enlaces `[[...]]` rotos.
- Contraste contra codigo: las referencias a `CreateActivityModal`, `useActivities.updateActivity`, `SyncEngine`, `/e2e/activities-checklist` y `activity_checklist_autosave.spec.ts` existen y coinciden con el flujo implementado.
- Correcciones aplicadas: ninguna; el ingest previo ya cubria los cambios.

## 2026-07-10 - Lint: Wiki posterior a autosave de checklist Planner

Ejecucion del workflow `.agents/workflows/wiki-lint.md` despues del arreglo de checklist en actividades.
- Estructura: `missing=0`, `orphans=0`; no hay paginas faltantes ni huerfanas.
- Enlaces: `broken=0`; los enlaces `[[...]]` resuelven contra paginas existentes o el pendiente legitimo `tiendas`.
- Contraste contra codigo: `wiki/pages/actividades.md` referencia `CreateActivityModal`, `useActivities.updateActivity`, `SyncEngine`, `/e2e/activities-checklist` y `activity_checklist_autosave.spec.ts`, todos existentes.
- Correcciones aplicadas: ninguna adicional despues del ingest.

## 2026-07-10 - Lint: Wiki posterior a guards de wizards

Ejecucion del workflow `.agents/workflows/wiki-lint.md` despues del ingest de wizards.
- Estructura: `missing=0`, `orphans=0`; todas las paginas listadas existen y no hay paginas huerfanas.
- Enlaces: `broken=0`; los enlaces `[[...]]` resuelven contra paginas existentes o el pendiente legitimo `tiendas`.
- Contraste contra codigo: las notas nuevas referencian componentes y rutas existentes (`CreateActivityModal`, `CreateContactWizard`, `PedidoEditorForm`, `CreateOpportunityWizard`, `/e2e/activities-wizard`).
- Correcciones aplicadas: ninguna adicional despues del ingest.

## 2026-07-10 - Ingest: Autosave de checklist Planner en actividades

Correccion del guardado de actividades/checklist dentro de tareas editadas.
- Causa: el checklist de Planner vivia en estado React independiente y no era observado por `useFormAutoSave`; ademas `useActivities.updateActivity` filtraba `_sync_metadata`, perdiendo el checklist antes de Dexie/outbox/Supabase.
- Cambio: `CreateActivityModal` guarda checklist con debounce propio, persiste `checklist` en `_sync_metadata`, intenta PATCH a `/api/microsoft/planner/tasks/[taskId]` y marca `pending_planner_update` si debe reintentarse.
- Sync: `lib/sync.ts` procesa `pending_planner_update` y reenvia el checklist a Planner cuando vuelve la sincronizacion.
- Validacion: `npx playwright test -c playwright.e2e.config.ts create_account_wizard.spec.ts create_activity_wizard.spec.ts activity_checklist_autosave.spec.ts --project=chromium --reporter=line` paso con 3 tests.
- Paginas actualizadas: `wiki/pages/actividades.md`.

## 2026-07-10 - Ingest: Proteccion final de wizards de creacion

Actualizacion transversal de wizards multi-paso para evitar submits accidentales al entrar al ultimo paso.
- Actividades: `CreateActivityModal` bloquea el submit final hasta estar en "Detalles" y esperar una ventana corta; se agrego ruta dev-only `/e2e/activities-wizard` y spec `e2e/create_activity_wizard.spec.ts`.
- Contactos, Pedidos y Oportunidades: se replico el guard de ultimo paso y la habilitacion diferida del boton final.
- Validacion: `npx playwright test -c playwright.e2e.config.ts create_account_wizard.spec.ts create_activity_wizard.spec.ts --project=chromium --reporter=line` paso con 2 tests.
- Nota de verificacion: `npx tsc --noEmit --pretty false` sigue bloqueado por errores de sintaxis preexistentes en `n8n-mcp/scripts/*` y `workflows/*`.
- Paginas actualizadas: `wiki/pages/actividades.md`, `wiki/pages/contactos.md`, `wiki/pages/cotizaciones-y-pedidos.md`, `wiki/pages/oportunidades.md`.

## 2026-07-09 — Lint: Salud general del LLM Wiki

Ejecución del workflow `.agents/workflows/wiki-lint.md` sobre `wiki/`.
- Estructura: todas las páginas listadas en `wiki/INDEX.md` existen y no se detectaron páginas huérfanas en `wiki/pages/`.
- Enlaces: no se detectaron enlaces `[[...]]` rotos; no hubo pendientes nuevos fuera de `tiendas`, que sigue listado como pendiente legítimo.
- Fuentes: todas las páginas tienen sección `## Fuentes`.
- Contraste contra código: se verificaron afirmaciones clave de Cuentas/E2E, auditoría local, sincronización offline, roles/permisos, comisiones y canales contra `app/`, `components/`, `lib/` y `supabase/`.
- Correcciones aplicadas: ninguna adicional; el ingest previo de `cuentas.md` y `LOG.md` ya estaba consistente.

## 2026-07-09 — Ingest: Protección de submit final en wizard de cuentas

Actualización del módulo de Cuentas para reflejar el comportamiento del wizard de creación.
- `CreateAccountWizard.tsx` crea cuentas mediante 3 pasos: información base, ubicación/contacto y clasificación.
- El submit final queda protegido: la cuenta solo se crea desde el último paso con `Crear Cuenta`, evitando saltos accidentales por doble clic o activación repetida.
- Se añadió ruta E2E dev-only `/e2e/cuentas-wizard`, spec `e2e/create_account_wizard.spec.ts` y config `playwright.e2e.config.ts` para probar el flujo sin login manual.
- Páginas actualizadas: `wiki/pages/cuentas.md`.

## 2026-07-09 — Ingest: Wizards de Creación y Auto-Save en Edición

Implementación de Wizards paso a paso para la creación de registros y auto-guardado debounced para edición en múltiples módulos (Cuentas, Contactos, Actividades y Pedidos).
- **Módulo de Cuentas:** Creado `CreateAccountWizard.tsx` (Wizard de 3 pasos) y adaptado `AccountForm.tsx` con auto-guardado (1.5 segundos) e indicador `AutoSaveIndicator`.
- **Módulo de Contactos:** Creado `CreateContactWizard.tsx` (Wizard con modal protegido) y adaptado `ContactForm.tsx` con auto-guardado debounced.
- **Módulo de Actividades:** Adaptado `CreateActivityModal.tsx` para actuar como Wizard de 3 pasos en creación y como Editor con auto-guardado debounced.
- **Módulo de Pedidos:** Adaptado `PedidoEditorForm` en `PedidosEditor.tsx` para actuar como Wizard de 3 pasos en creación y como Editor con auto-guardado debounced.
- Páginas actualizadas: `wiki/pages/actividades.md`, `wiki/pages/cotizaciones-y-pedidos.md`.

## 2026-07-09 — Ingest: Log de Auditoría Local (Historial de Modificaciones)

Implementación de un log de modificaciones y creaciones locales por usuario en el módulo de Configuración.
- Se implementó la persistencia local en Zustand + LocalStorage (`useAuditLogStore`), evitando sobrecargar Supabase.
- Se integró la interceptación centralizada en `SyncEngine.queueMutation` para detectar si una acción es `CREATE` o `UPDATE` y resolver el nombre amigable de la entidad antes de aplicar la mutación.
- **Optimización de Detalle y Contexto:** Se añadió resolución inteligente para sub-items (ej: `Mezclador Lavamanos en COT-052139`) y comparación fina de cambios campo por campo mostrando flechas de transición `(valor_anterior → valor_nuevo)` y filtrando snapshots sin modificaciones reales.
- Se añadió el componente visual premium responsivo de Historial al final de la página de Configuración (`/configuracion`).
- Páginas creadas/actualizadas: `wiki/pages/auditoria-local.md`, `wiki/INDEX.md`, `wiki/LOG.md`.

## 2026-07-09 — Lint: Motor de guardado sin internet (sincronizacion-offline)

Ejecución de la rutina de validación /wiki-lint sobre el motor de guardado sin internet (Dexie / SyncEngine).
- Hallazgos: Se contrastó la página `sincronizacion-offline.md` con el código actual. Se encontró que omitía el "Modo Snapshot" de mutaciones (`_complete_snapshot_`), el cual está plenamente soportado tanto en `SyncEngine` como en la función de base de datos `process_field_updates`. También se identificaron múltiples mecanismos de auto-curación (Self-Healing) del motor que no estaban documentados.
- Correcciones aplicadas: Se actualizó `wiki/pages/sincronizacion-offline.md` incorporando la descripción del Modo Snapshot, su procesamiento por LWW a nivel de base de datos, y los 4 flujos de auto-curación principales (NIT duplicado, cuenta padre faltante, fase inválida y actividad huérfana).
- Estado de enlaces: Ningún enlace roto o huérfano detectado en esta sección.

## 2026-07-08 — Ingest: Soporte de Columnas y Reporte S&OP Comercial

Adición de soporte técnico y de negocio para la generación del informe de S&OP Comercial.
- Adición de las columnas `planta` y `familia` a `CRM_ListaDePrecios` y `CRM_Productos` para el desglose del catálogo.
- Creación de la lógica del informe S&OP en la página de Informes con descargas pre-filtradas en Excel (con pestañas `S&OP` y la tabla de contingencia resumen `TD`) y CSV.
- Consideración automática de la fragmentación de pedidos parciales sobre las oportunidades comerciales para el cálculo de fechas de planta y comercial.
- Páginas actualizadas: `modelo-de-datos`, `dashboard-e-indicadores`.

## 2026-07-07 — Ingest: Remoción de Handsontable y restauración de vistas premium

Eliminación completa de la dependencia Handsontable en Oportunidades, Cuentas y Contactos, reemplazándola por una galería de tarjetas premium responsiva y tablas interactivas nativas.
- Páginas actualizadas: `arquitectura-general`, `cuentas`.

## 2026-07-07 — Ingest inicial (creación del wiki)

Análisis completo de la funcionalidad del CRM Firplak y creación del wiki desde cero,
siguiendo el patrón LLM Wiki de Karpathy
(https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

- Fuentes analizadas: estructura de `app/` (rutas), `lib/` (hooks, sync, permisos,
  integraciones), `components/`, `supabase/schema.sql` + 80 migraciones, `docs/`,
  `bugs-knowhow.md`, `package.json`, Sidebar (módulos de navegación).
- Páginas creadas (14): arquitectura-general, modelo-de-datos, sincronizacion-offline,
  roles-y-permisos, oportunidades, cuentas, contactos, actividades,
  cotizaciones-y-pedidos, comisiones, canales-de-venta, notificaciones, integraciones,
  dashboard-e-indicadores.
- Pendiente detectado: página `tiendas` (módulo en construcción).
- Estado de la app al momento del ingest: versión 1.1.0.4, rama `alejo`.
