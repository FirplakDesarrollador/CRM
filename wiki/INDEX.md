# INDEX — Catálogo del Wiki

> Una línea por página. Leer este archivo primero al consultar el wiki.
> Reglas de mantenimiento en [SCHEMA.md](SCHEMA.md). Historial en [LOG.md](LOG.md).

## Fundamentos

- [arquitectura-general](pages/arquitectura-general.md) — Qué es el CRM Firplak: PWA offline-first con Next.js 16 + Supabase + Dexie; mapa de módulos y principios de diseño.
- [modelo-de-datos](pages/modelo-de-datos.md) — Todas las tablas `CRM_*`, tablas de referencia, convenciones (soft-delete, `_sync_metadata`, RLS).
- [sincronizacion-offline](pages/sincronizacion-offline.md) — SyncEngine: patrón outbox por campo, conflictos LWW, orden de tablas por FK, pull de cambios.
- [roles-y-permisos](pages/roles-y-permisos.md) — Roles ADMIN/COORDINADOR/VENDEDOR, matriz de permisos, `allowed_modules`, coordinadores, RLS y auth.
- [auditoria-local](pages/auditoria-local.md) — Registro local de modificaciones y creaciones de datos por usuario, persistido en localStorage con Zustand.

## Módulos de negocio

- [oportunidades](pages/oportunidades.md) — Negocios en curso: fases por canal, estados, colaboradores, transferencias, motivos de pérdida, embudo.
- [cuentas](pages/cuentas.md) — Clientes/empresas: canal obligatorio, jerarquía de sucursales, niveles premium, propietario, carga masiva, auditoría.
- [contactos](pages/contactos.md) — Personas de las cuentas; importación vCard y auto-contacto del canal Propio.
- [actividades](pages/actividades.md) — Tareas/eventos con clasificaciones configurables, vínculo a Outlook y alertas de vencimiento.
- [cotizaciones-y-pedidos](pages/cotizaciones-y-pedidos.md) — Ciclo DRAFT→WINNER, precios por canal, descuentos por volumen, campos SAP `EXTRA_`, PDF F-V-29, módulo Pedidos.
- [comisiones](pages/comisiones.md) — Motor en PostgreSQL: regla "lowest wins", reglas/categorías/ledger/bonos, trigger por cotización ganadora, reparto con colaboradores.
- [canales-de-venta](pages/canales-de-venta.md) — Los 5 canales inmutables (OBRAS_NAC/INT, DIST_NAC/INT, PROPIO) y cómo determinan precios, fases y subclasificaciones.

## Transversales

- [notificaciones](pages/notificaciones.md) — Reglas configurables, evento ACTIVITY_OVERDUE, campana in-app, cron con Edge Function.
- [integraciones](pages/integraciones.md) — Microsoft Graph (correo/calendario/Planner), SAP por cola, lead intake de WordPress, ForceManager.
- [dashboard-e-indicadores](pages/dashboard-e-indicadores.md) — Dashboard de tiles, embudo, indicadores KPI, informes Excel (ADMIN) y metas con expiración automática.

## Páginas pendientes (enlaces `[[...]]` sin página)

- `tiendas` — módulo en construcción (`/tiendas`); ya existen modales de venta y actividad de tienda. Crear página cuando el módulo madure.
