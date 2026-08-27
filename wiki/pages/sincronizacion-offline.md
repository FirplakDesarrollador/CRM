# Sincronización Offline (SyncEngine)

El CRM funciona bajo un modelo local-first: las operaciones se escriben primero en IndexedDB mediante Dexie y `SyncEngine` las replica a Supabase cuando hay red. El motor separa explícitamente el envío de cambios locales del pull de datos remotos, protege el trabajo no sincronizado y mantiene cursores durables por usuario. Es la pieza más delicada de la [[arquitectura-general]].

## Patrón Outbox

Cada mutación local genera o actualiza un `OutboxItem`:

```text
{ id, entity_type, entity_id, field_name, old_value, new_value,
  field_timestamp, status, retry_count, next_attempt_at?, last_attempt_at? }
```

Los estados posibles son `PENDING`, `SYNCING`, `FAILED`, `DEAD_LETTER` y `COMPLETED`.

### Modos de mutación

- **Modo granular:** conserva un ítem por campo modificado para permitir resolución LWW a nivel de campo.
- **Modo snapshot:** usa `field_name: '_complete_snapshot_'` y transporta el registro consolidado para inserciones o actualizaciones complejas.
- **Compactación al encolar:** `queueMutation()` opera dentro de una transacción Dexie. Reutiliza mutaciones pendientes de la misma entidad/campo y fusiona cambios granulares dentro del snapshot existente. Una nueva edición reinicia error, contador y programación de reintento.
- **Mutaciones en vuelo:** un ítem `SYNCING` no se modifica. Si el usuario vuelve a editar durante el envío se crea una mutación posterior, evitando alterar el payload ya reclamado.
- **Autosave estable:** `useFormAutoSave` conserva el callback más reciente en un ref; los rerenders con callbacks inline no cancelan el único guardado pendiente.

## Push y pull desacoplados

- `triggerPush(reason)` procesa únicamente el Outbox y nunca consulta las tablas del CRM. Se usa después de una mutación, al recuperar la conexión y para los reintentos.
- `triggerSync(reason)` realiza un ciclo completo: autentica, captura una frontera temporal, recupera leases vencidos, hace push, ejecuta el pull y finalmente confirma el cursor.
- El montaje de la aplicación, el intervalo de cinco minutos, el retorno visible a la pestaña y la acción manual de Configuración pueden solicitar un ciclo completo.
- El evento `online`, los autosaves y los procesos de autocuración solicitan exclusivamente push.

## Reclamo, lotes y reintentos

`pushChanges()` procesa hasta 50 lotes consecutivos de 500 ítems. Cada lote se selecciona y cambia a `SYNCING` dentro de una transacción Dexie, registrando `last_attempt_at`.

- Un lease `SYNCING` solo se recupera después de dos minutos. Esto evita que una segunda pestaña reclame inmediatamente el trabajo activo de otra.
- Los errores usan backoff exponencial y `next_attempt_at`; un único temporizador programa el siguiente push elegible.
- Después de cinco intentos, la mutación pasa a `DEAD_LETTER`. Nunca se borra automáticamente.
- `/configuracion` muestra los bloqueados y ofrece **Reintentar bloqueados**. Una nueva edición de la entidad también reactiva la mutación y reinicia sus reintentos.
- La respuesta RPC se correlaciona por `mutation_id`, evitando confundir dos cambios concurrentes sobre la misma entidad y campo.

## Resolución de conflictos y seguridad del RPC

`process_field_updates` implementa LWW comparando el timestamp entrante con `_sync_metadata`:

- En modo granular aplica el valor únicamente si el timestamp nuevo es mayor y persiste el timestamp aceptado para ese campo.
- En modo snapshot inserta el registro completo si no existe o compara campo por campo cuando ya existe.
- Las columnas generadas (`is_generated = 'ALWAYS'`) como `CRM_CotizacionItems.subtotal` se filtran y omiten automáticamente tanto en el cliente (`lib/sync.ts`, `queueMutation`) como en el RPC PostgreSQL (`process_field_updates`), evitando rechazos SQL `column "subtotal" can only be updated to DEFAULT`.
- `CRM_Cuentas.nit` se valida contra el límite de `int32`; `nit_base` conserva el valor textual completo.

La migración `20260821230051_harden_sync_engine.sql` mueve la implementación heredada a un esquema privado, usa `SECURITY INVOKER`, verifica que `p_user_id = auth.uid()`, limita las tablas permitidas y deja las políticas RLS como autoridad de acceso.

> ⚠️ La migración debe aplicarse y validarse en Supabase antes de desplegar el cliente que depende de ella.

## Pull incremental seguro

El cursor principal ya no depende únicamente de Zustand/localStorage. Dexie v13 incorpora `syncCursors`, con claves aisladas por `user_id` y tabla lógica.

1. `triggerSync()` captura `syncUpperBound` antes del push y del pull.
2. Cada consulta incremental cubre desde el cursor confirmado hasta `syncUpperBound`.
3. Los errores por tabla se acumulan y se propagan; un pull parcial se considera fallido.
4. El cursor `__global__` avanza solamente cuando todas las tablas terminan correctamente.

Este protocolo evita saltar cambios creados mientras el pull está en curso y evita confirmar una ventana incompleta.

### Paginación y límites

Las consultas usan orden determinista y páginas PostgREST de 1.000 filas mediante `.range()`:

- Los deltas incrementales recorren todas las páginas hasta completar la ventana, con un tope de seguridad de 100.000 filas.
- Los bootstrap de entidades voluminosas conservan límites funcionales —por ejemplo, 3.000 cuentas generales recientes— sin depender del límite implícito del API.
- Los feeds de borrado y las tablas hijas tienen topes explícitos acordes a su volumen.
- `CRM_PedidoItems` usa `updated_at` para detectar ediciones; la migración crea la columna, su trigger y el índice `(updated_at, id)`.

## Catálogos con ciclo independiente

Los catálogos no se descargan en cada sincronización. El cursor `__catalogs__` tiene un TTL de 24 horas y se refresca antes si las tablas locales esenciales están vacías.

Se paginan fases, subclasificaciones, segmentos, países, departamentos, ciudades y clasificaciones/subclasificaciones de actividades. Las operaciones administrativas pueden actualizar Dexie directamente o usar refrescos dirigidos como `refreshPhases()`, sin disparar un pull global.

## Pull segmentado por usuario

- **Prioridad del asesor:** descarga las cuentas y oportunidades asignadas, creadas o compartidas con el usuario autenticado.
- **Descubrimiento general:** conserva una ventana de las 3.000 cuentas más recientes para búsqueda y autocompletado.
- **Casos especiales:** en `CRM_Pedidos`, el `id` del servidor se mapea a `uuid_generado` local y el estado se normaliza a `estado_pedido`. Los campos `EXTRA_` de SAP requieren parsing propio; ver [[integraciones]] y `bugs-knowhow.md`.

## Orden de sincronización

El Outbox respeta las dependencias FK:

1. `CRM_Cuentas`
2. `CRM_Contactos`
3. `CRM_Oportunidades`
4. `CRM_Oportunidades_Colaboradores`
5. `CRM_Cotizaciones`
6. `CRM_CotizacionItems`
7. `CRM_Actividades`
8. `CRM_Pedidos`
9. `CRM_PedidoItems`

## Auto-curación

El motor conserva flujos de recuperación para NIT duplicado (con reasignación profunda de `account_id` en mutaciones planas y snapshots estructurados), contactos duplicados por teléfono (`unique_active_contact_phone`), contactos con cuentas huérfanas (`fk_crmcontactos_account`), cuentas padre faltantes, fases inválidas y actividades huérfanas. Las reparaciones reencolan snapshots o campos necesarios y luego ejecutan push-only; no descargan nuevamente todo el CRM.

Los colaboradores inválidos o huérfanos se conservan en `DEAD_LETTER` con su error para diagnóstico, en lugar de eliminarse.

## Observabilidad y recuperación

Dexie v13 incorpora `syncRuns`, que conserva las últimas 100 ejecuciones con tipo (`PUSH` o `FULL_SYNC`), disparador, estado, duración, pendientes antes/después y error.

Desde `/configuracion` se puede:

- revisar el Outbox y las ejecuciones recientes;
- reintentar elementos `DEAD_LETTER`;
- refrescar únicamente las fases;
- ejecutar `cleanResync()`.

`cleanResync()` vacía las tablas reales de caché y el cursor del usuario, preserva todo el Outbox —incluidos `FAILED` y `DEAD_LETTER`— y solo confirma el nuevo cursor después de un pull completo exitoso.

## Mapeo SAP

`SAP_MAPPING` en `lib/sync.ts` traduce campos de cotización (`incoterm`, `flete`, `orden_compra`, etc.) a los nombres `EXTRA_*` esperados por SAP. Ver [[cotizaciones-y-pedidos]].

## Validación automatizada

El subsistema dispone de pruebas aisladas para políticas de backoff, leases, TTL de catálogos, compactación concurrente, recuperación de `DEAD_LETTER`, separación push/pull, telemetría y autosave con callbacks inestables.

Comandos de verificación:

```text
npm run typecheck:sync
npm run test:sync
npm run build
```

## Fuentes

- `lib/sync.ts`, `lib/sync-runtime.ts`, `lib/db.ts`
- `lib/hooks/useFormAutoSave.ts`, `lib/hooks/useActivityClassifications.ts`
- `components/layout/AppLayout.tsx`, `app/configuracion/page.tsx`
- `supabase/migrations/20260821230051_harden_sync_engine.sql`
- `lib/sync-runtime.test.ts`, `lib/sync-engine.test.ts`, `lib/hooks/useFormAutoSave.test.tsx`
- `bugs-knowhow.md` (diagnósticos puntuales y reglas preventivas)
