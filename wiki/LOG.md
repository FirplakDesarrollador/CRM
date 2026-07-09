# LOG — Registro de Operaciones del Wiki

> Orden cronológico inverso (lo más reciente arriba). Una entrada por operación
> de ingest/lint significativa. Formato: fecha — operación — resumen.

## 2026-07-09 — Ingest: Log de Auditoría Local (Historial de Modificaciones)

Implementación de un log de modificaciones y creaciones locales por usuario en el módulo de Configuración.
- Se implementó la persistencia local en Zustand + LocalStorage (`useAuditLogStore`), evitando sobrecargar Supabase.
- Se integró la interceptación centralizada en `SyncEngine.queueMutation` para detectar si una acción es `CREATE` o `UPDATE` y resolver el nombre amigable de la entidad antes de aplicar la mutación.
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
