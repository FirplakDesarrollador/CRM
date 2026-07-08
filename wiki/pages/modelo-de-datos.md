# Modelo de Datos

Todas las tablas del servidor (Supabase/PostgreSQL) llevan el prefijo `CRM_`. El cliente
mantiene un espejo local en IndexedDB vía Dexie (`lib/db.ts`) con interfaces `Local*`
(`LocalCuenta`, `LocalQuote`, ...). Ver [[sincronizacion-offline]] para cómo se replican.

## Tablas núcleo (schema.sql)

| Tabla | Contenido |
|---|---|
| `CRM_Usuarios` | Usuarios de la app, rol, `allowed_modules`, coordinadores. Ver [[roles-y-permisos]] |
| `CRM_Cuentas` | Clientes/empresas: NIT, canal (`canal_id`), propietario, nivel premium, geografía. Ver [[cuentas]] |
| `CRM_Contactos` | Personas asociadas a cuentas. Ver [[contactos]] |
| `CRM_Oportunidades` | Negocios en curso: fase, estado, probabilidad, motivo de pérdida. Ver [[oportunidades]] |
| `CRM_OportunidadColaboradores` | Colaboradores de una oportunidad (afecta reparto de [[comisiones]]) |
| `CRM_TransferenciasOportunidad` | Historial de transferencias de oportunidades entre vendedores |
| `CRM_Actividades` | Tareas, eventos, llamadas, visitas; con clasificación y subclasificación. Ver [[actividades]] |
| `CRM_Cotizaciones` | Cotizaciones y pedidos (`es_pedido`), estado, ganadora (`is_winner`), campos SAP y de PDF. Ver [[cotizaciones-y-pedidos]] |
| `CRM_CotizacionItems` | Líneas de producto de una cotización, con descuentos |
| `CRM_Pedidos` / `CRM_PedidoItems` | Pedidos logísticos derivados de cotizaciones ganadoras (campos `EXTRA_` de SAP) |
| `CRM_Productos` | Catálogo de productos |
| `CRM_ListaDePrecios` | Precios por columna/canal. Ver [[canales-de-venta]] |
| `CRM_Canales` | Los 5 canales de venta inmutables. Ver [[canales-de-venta]] |
| `CRM_SapIntegrationQueue` | Cola de integración hacia SAP. Ver [[integraciones]] |
| `CRM_Files` | Archivos adjuntos |
| `CRM_Parameters` | Parámetros de configuración |

## Tablas de referencia

- `CRM_Currencies`, `CRM_ExchangeRates` — monedas y tasas de cambio.
- `CRM_EstadosOportunidad`, `CRM_FasesOportunidad` — estados y fases por canal (ver [[oportunidades]]).
- `CRM_TiposActividad` — tipos de actividad.
- Catálogos geográficos de Colombia: países, departamentos, ciudades (migraciones `20260126/20260127`).

## Tablas añadidas por migraciones

- **Comisiones** (`2026-02-10` en adelante): reglas, categorías, ledger, reglas de bonos. Ver [[comisiones]].
- **Metas** (`20260127_create_goals_table`): objetivos por usuario con fecha límite y expiración automática. Ver [[dashboard-e-indicadores]].
- **Notificaciones** (`20260212_create_notification_system`): reglas y notificaciones. Ver [[notificaciones]].
- **Segmentos** (`20260121_segments`, `quote_segments`): segmentación de cotizaciones/pedidos.
- **Subclasificaciones** (`20260119`, `20260212`): subclasificación de cuentas por canal.
- **Auditoría**: `CRM_Audit_Cuentas` registra cambios en cuentas.
- **S&OP** (`20260708_add_sop_columns`): campos `planta` y `familia` en `CRM_ListaDePrecios` y `CRM_Productos` para el informe de planificación.

## Convenciones

- Soft-delete con `is_deleted` (actividades, colaboradores) en lugar de borrado físico.
- Metadatos de sincronización `_sync_metadata` por fila (timestamps por campo para LWW).
- RLS habilitado en todas las tablas (`20260213_enable_rls_all_tables.sql`).

## Fuentes

- `supabase/schema.sql`
- `supabase/migrations/` (cronología completa de cambios)
- `lib/db.ts` (espejo local Dexie)
