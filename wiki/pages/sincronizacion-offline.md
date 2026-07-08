# Sincronización Offline (SyncEngine)

El CRM funciona sin conexión: todas las operaciones se escriben primero en IndexedDB (Dexie)
y un motor de sincronización (`SyncEngine` en `lib/sync.ts`) las replica a Supabase cuando
hay red. Es la pieza más delicada de la [[arquitectura-general]].

## Patrón Outbox

Cada mutación local genera un `OutboxItem` **por campo modificado**:

```
{ entity_type, entity_id, field_name, old_value, new_value, field_timestamp,
  status: PENDING | SYNCING | FAILED | COMPLETED, retry_count }
```

- Granularidad de campo: dos usuarios pueden editar campos distintos del mismo registro sin pisarse.
- Reintentos con backoff exponencial (`2^n` segundos, tope 30s, máximo 5 reintentos).
- El estado del sync se expone en la UI vía `useSyncStore` (Zustand) y el componente
  `SyncStatus` / `OfflineBanner`; puede pausarse manualmente.

## Resolución de conflictos: LWW (Last-Write-Wins)

En el servidor, RPCs (`rpc_lww.sql`, migraciones `robust_sync_rpc`, `generic_sync_rpc`)
comparan el timestamp del campo entrante contra `_sync_metadata` de la fila; solo aplican
el cambio si `v_ts > v_last_ts`. ⚠️ Si se hacen updates manuales en la DB con timestamps
futuros, se "brickean" los registros: los cambios legítimos del cliente serán rechazados
(documentado en `bugs-knowhow.md` §2).

## Orden de sincronización (integridad referencial)

El outbox se procesa por prioridad de tabla para respetar las FK:

1. `CRM_Cuentas` → 2. `CRM_Contactos` → 3. `CRM_Oportunidades` → 4. Colaboradores →
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
