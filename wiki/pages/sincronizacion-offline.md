# Sincronización Offline (SyncEngine)

El CRM funciona sin conexión: todas las operaciones se escriben primero en IndexedDB (Dexie)
y un motor de sincronización (`SyncEngine` en `lib/sync.ts`) las replica a Supabase cuando
hay red. Es la pieza más delicada de la [[arquitectura-general]].

## Patrón Outbox

Cada mutación local genera un `OutboxItem`:

```
{ entity_type, entity_id, field_name, old_value, new_value, field_timestamp,
  status: PENDING | SYNCING | FAILED | COMPLETED, retry_count }
```

### Modos de Mutación
- **Modo Normal (Granular):** Genera un `OutboxItem` por campo modificado. Dos usuarios pueden editar campos distintos del mismo registro sin pisarse (LWW a nivel de campo).
- **Modo Snapshot:** Si se especifica `isSnapshot: true` (ej. en pedidos u oportunidades complejas), se crea un único item con `field_name: '_complete_snapshot_'` conteniendo todo el payload del objeto para una inserción o actualización consolidada.

- Reintentos con backoff exponencial (`2^n` segundos, tope 30s, máximo 5 reintentos).
- El estado del sync se expone en la UI vía `useSyncStore` (Zustand) y el componente
  `SyncStatus` / `OfflineBanner`; puede pausarse manualmente desde la página de Configuración.

## Resolución de conflictos: LWW (Last-Write-Wins)

En el servidor, la función RPC `process_field_updates` (definida en `rpc_lww.sql` y migraciones asociadas) maneja la resolución LWW comparando los timestamps entrantes contra el objeto `_sync_metadata` de la fila:
- **En Modo Normal:** Aplica el cambio solo si `v_ts > v_last_ts` para ese campo específico.
- **En Modo Snapshot:** 
  - Si el registro no existe en el servidor: Realiza un INSERT atómico y guarda el timestamp en todos los campos en `_sync_metadata`.
  - Si el registro existe: Compara el timestamp contra cada campo del registro en `_sync_metadata` de la base de datos, actualizando solo las columnas donde el cambio entrante sea estrictamente más reciente.

⚠️ Si se hacen updates manuales en la DB con timestamps futuros, se "brickean" los registros: los cambios legítimos del cliente serán rechazados (documentado en `bugs-knowhow.md` §2).

## Auto-curación (Self-Healing)

El `SyncEngine` implementa flujos automáticos de corrección de datos para evitar bloqueos:
1. **Resolución de NIT Duplicado:** Si el RPC de una cuenta falla por clave única de NIT (`idx_crmcuentas_nit_base_root`), inicia una resolución automática que re-asocia el ID local con la cuenta existente en el servidor.
2. **Cuentas Padres Faltantes:** Si una oportunidad se sincroniza pero su cuenta padre no existe en el servidor, el motor detecta la inconsistencia, busca la cuenta local en Dexie y la re-encola prioritariamente.
3. **Fases Inválidas:** Si una oportunidad tiene una fase local no válida, se mapea automáticamente a la fase por defecto correspondiente al canal de ventas de su cuenta.
4. **Actividades Huérfanas:** Si una actividad en el servidor pierde su vinculación con la oportunidad (`opportunity_id`) pero localmente existe, se restaura y se encola un update.

## Orden de sincronización (integridad referencial)

El outbox se procesa por prioridad de tabla para respetar las FK:

1. `CRM_Cuentas` → 2. `CRM_Contactos` → 3. `CRM_Oportunidades` → 4. Colaboradores (`CRM_Oportunidades_Colaboradores`) →
5. `CRM_Cotizaciones` → 6. `CRM_CotizacionItems` → 7. `CRM_Actividades` →
8. `CRM_Pedidos` → 9. `CRM_PedidoItems`

## Pull (servidor → cliente)

`pullChanges` descarga cambios del servidor hacia Dexie. Casos especiales conocidos:
en `CRM_Pedidos` el `id` del servidor se mapea a `uuid_generado` local y el estado se
normaliza a `estado_pedido`; los campos `EXTRA_` de SAP requieren parsing propio
(ver [[integraciones]] y `bugs-knowhow.md` §5).

## Mapeo SAP

`SAP_MAPPING` en `lib/sync.ts` traduce campos de cotización (`incoterm`, `flete`,
`orden_compra`, ...) a los nombres `EXTRA_*` que espera SAP. Ver [[cotizaciones-y-pedidos]].

## Disparadores del sync

- Evento `online` del navegador.
- Tras cada mutación local (trigger explícito).
- Al iniciar sesión se limpian los items `COMPLETED` de la sesión anterior.

## Fuentes

- `lib/sync.ts` (motor), `lib/db.ts` (esquema Dexie), `lib/stores/useSyncStore.ts`
- `supabase/rpc_lww.sql`, migraciones `20260114_fix_sync_rpc`, `20260115_robust_sync_rpc`, `20260117_fix_sync_lww_error_handling`, `20260227_generic_sync_rpc`
- `components/layout/SyncStatus.tsx`, `components/layout/OfflineBanner.tsx`, `app/offline/page.tsx`
