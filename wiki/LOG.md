# LOG — Registro de Operaciones del Wiki

> Orden cronológico inverso (lo más reciente arriba). Una entrada por operación
> de ingest/lint significativa. Formato: fecha — operación — resumen.

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
