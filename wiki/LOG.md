# LOG — Registro de Operaciones del Wiki

> Orden cronológico inverso (lo más reciente arriba). Una entrada por operación
> de ingest/lint significativa. Formato: fecha — operación — resumen.

## 2026-09-02 - UX: Persistencia y Ejecución de Filtros entre Navegación de Módulos

- **Módulos Afectados (`/oportunidades`, `/cuentas`, `/contactos`, `/actividades`):**
  - Se corrigió el flujo de sincronización entre el estado visual de la barra superior (UserPickerFilter, búsqueda y filtros jerárquicos) y las funciones conmutadoras de las hooks de datos de servidor (`useOpportunitiesServer`, `useAccountsServer`, `useContactsServer`, `useActivities`).
  - Se aseguró que al navegar entre módulos o al ingresar desde la barra lateral sin parámetros de URL, los filtros guardados en `sessionStorage` se inyecten dinámicamente a las hooks de consulta, garantizando que los datos de la tabla se filtren en tiempo real coincidiendo 100% con la barra superior.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-09-02 - UI: Reordenamiento y Renombrado a OPORTUNIDAD en Oportunidades

- **Módulo de Oportunidades (`app/oportunidades/page.tsx`):**
  - Se configuró la columna **OPORTUNIDAD** (antiguo "NOMBRE") como la primera columna inicial de la tabla interactiva (Handsontable), seguida por **CUENTA**, **PAÍS**, **CIUDAD** y **CANAL**.
  - Se incrementó el número de versión de la clave de columnas en `localStorage` (`crm_opp_visible_cols_v3`) para forzar el reordenamiento a todos los usuarios.
- **Páginas actualizadas:** `wiki/pages/oportunidades.md`, `wiki/LOG.md`.

## 2026-09-02 - UI: Columnas País, Ciudad y Canal en el Módulo de Oportunidades

- **Módulo de Oportunidades (`app/oportunidades/page.tsx` & `useOpportunitiesServer.ts`):**
  - Se extendió la consulta de la cuenta vinculada (`account`) para extraer `ciudad` y `pais_id`.
  - Se agregaron las columnas **País**, **Ciudad** y **Canal** a la vista de tabla interactiva (Handsontable), heredadas automáticamente de la cuenta a la que pertenece la oportunidad.
  - Se activó el redimensionamiento manual de columnas (`manualColumnResize`) con soporte de cursor interactivo `col-resize` (`↔`).
  - Se incluyeron los datos de ubicación y canal en las tarjetas móviles.
- **Páginas actualizadas:** `wiki/pages/oportunidades.md`, `wiki/LOG.md`.

## 2026-09-02 - UI: Visualización del campo País en la Vista Inicial de Cuentas

- **Módulo de Cuentas (`app/cuentas/page.tsx`):**
  - Se agregó la columna **País** a la vista de tabla interactiva (Handsontable) resolviendo dinámicamente el nombre del país a partir de `pais_id` y los catálogos locales/remotos (`CRM_Paises`).
  - Se integró el indicador de País con el ícono `Globe` en la vista móvil de tarjetas.
  - Se incluyó la búsqueda por País en `matchesSearchTokens` dentro de `useAccountsServer.ts`.
- **Páginas actualizadas:** `wiki/pages/cuentas.md`, `wiki/LOG.md`.

## 2026-08-31 - Ingest: NIT Alfanumérico Provisional Único y Restricción Numérica en Pedidos

- **Generador y Validador de NIT (`lib/nitUtils.ts`):**
  - Se introdujo `generateProvisionalNit()` (`PROV-XXXXXXXX`), `isProvisionalNit()` y `isValidRealNit()`.
  - Cuentas creadas o modificadas sin NIT en `/cuentas`, `/cuentas/nueva` o tiendas/feria reciben automáticamente un NIT alfanumérico provisional único.
  - La sincronización (`lib/sync.ts`) sanitiza `nit_base` para evitar cadenas vacías o nulas que violen el índice de unicidad `idx_crmcuentas_nit_base_root` de PostgreSQL.
- **Validación Estricta de NIT en Pedidos (`lib/pedidoFormalization.ts`, `PedidosEditor.tsx`):**
  - `getMissingPedidoFormalizationFields()` exige que `nit_cliente_final` sea un NIT real numérico (`/^\d{5,12}(-\d)?$/`).
  - Si el cliente tiene un NIT provisional `PROV-...`, la formalización, PDF y envío de la orden se bloquean con aviso explícito solicitando el NIT real del cliente.
- **Migración de Backfill (`supabase/migrations/20260831_backfill_provisional_nits.sql`):**
  - Backfill en Supabase para asignar NITs provisionales únicos a cuentas históricas sin NIT.
- **Páginas actualizadas:** `wiki/pages/cuentas.md`, `wiki/pages/cotizaciones-y-pedidos.md`, `wiki/LOG.md`.
- **Pruebas:** `pruebas unitarias/nitValidation.test.ts`, `pruebas unitarias/pedidoFormalization.test.ts`.

## 2026-08-31 - Ingest: Visibilidad de Errores en Auto-Guardado (`AutoSaveIndicator`)

- **Mejora en `useFormAutoSave` y `AutoSaveIndicator`:**
  - `useFormAutoSave` ahora retorna `errorMessage` especificando la regla de validación o excepción exacta que provocó el estado de error.
  - `AutoSaveIndicator` muestra y trunca dinámicamente el mensaje de error real (`errorMessage`) en lugar de mostrar un texto genérico `Error al guardar`.
- **Formularios actualizados:** `AccountForm.tsx`, `ContactForm.tsx`.
- **Pruebas:** `lib/hooks/useFormAutoSave.test.tsx`.
>>>>>>> origin/main

## 2026-08-28 - Ingest: Quality Gate Offline-First y Versionado de Migraciones

- **Hardening de Calidad y Gate Completo (`quality/`, `qa:gate`):**
  - Validación 100% VERIFIED en las 10 etapas requeridas del QA Gate: `harness-tests`, `drift`, `safe-change-policy`, `type-ratchet`, `lint-ratchet`, `product-tests`, `migration-static`, `e2e-chromium`, `production-build`, `pwa-offline-e2e`.
  - Versionado y registro de 95 archivos de migración en `supabase/migrations/` con regla `.gitignore`.
  - Validación completa offline-first: aislamiento Dexie por usuario, rollback atómico de outbox, persistencia de cola tras desconexión e idempotencia con `mutation_id`.
- **Incremento de versión a `1.1.3.6`.**
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-28 - Ingest: Vinculación Interactiva de Inventario con Oportunidades (`/inventarios`)

- **Resolución y Enlaces a Oportunidades (`InventoryManager.tsx`, `useInventory.ts`):**
  - Se implementó la resolución automática de nombres y enlaces a `CRM_Oportunidades` a partir de `referencia_id` en los movimientos de inventario (`CRM_InventarioMovimientos`).
  - **Log de Movimientos:** Cada fila con oportunidad asociada muestra un badge interactivo con icono de maletín y enlace directo a `/oportunidades/[id]`.
  - **Tarjetas de Productos Activos:** Cada producto con movimientos/reservas muestra las oportunidades asociadas con links directos y cantidades vinculadas.
  - **Formulario de Registro:** Se añadió un selector con autocompletado y búsqueda en tiempo real de oportunidades para asociar opcionalmente oportunidades al registrar entradas, salidas o reservas.
  - **Buscador/Filtro de Movimientos:** Se incorporó un filtro de búsqueda rápida por nombre de oportunidad, producto o notas.
- **Páginas actualizadas:** `wiki/pages/modelo-de-datos.md`, `wiki/LOG.md`.
- **Pruebas:** `tests/inventoryOpportunityLink.test.ts`.

## 2026-08-28 - Ingest: Indicador de Conexión en Tiempo Real (NetworkStatusLine)

- **Línea Luminosa de Red (`components/layout/NetworkStatusLine.tsx`):**
  - Implementación de barra luminosa de 2.5px con gradientes y resplandor neón (*glow*) entre el header (`TopBar`) y el contenido de los módulos (`AppLayout.tsx`).
  - Tres estados en tiempo real:
    - 🔵 **Azul Firplak / Cian:** Conexión activa y óptima.
    - 🟡 **Amarillo / Ámbar:** Conexión inestable o red lenta (`2g`, `slow-2g`, latencia > 1200ms).
    - 🔴 **Rojo:** Desconectado / Modo offline.
- **Hook `useNetworkQuality.ts` & Endpoint `/api/health`:**
  - Detección reactiva mediante `online`/`offline`, `navigator.connection` (Network Information API) y *heartbeat* pasivo ultraligero con `AbortController`.
- **Páginas actualizadas:** `wiki/pages/sincronizacion-offline.md`, `wiki/LOG.md`.

## 2026-08-28 - Ingest: Soporte Offline Completo y Caché SWR de Catálogos (Usuarios, Orígenes y Lista de Precios)

- **Patrón Stale-While-Revalidate (SWR):**
  - `useUsers.ts`: Persistencia local en `crm_cached_users` para carga instantánea (0ms) en render inicial y revalidación en segundo plano.
  - `useOpportunityOrigins.ts`: Caché local en `crm_cached_opportunity_origins` que asegura que los orígenes y sus defaults estén disponibles 100% offline.
  - `useProducts.ts`: Almacenamiento persistente del catálogo completo de precios en IndexedDB (`crm_products_cache_db`), permitiendo búsquedas tokenizadas sin conexión y eliminando descargas de red repetidas.
- **Formulario de Tiendas (`CreateStoreSaleForm.tsx`):**
  - Alineación de validaciones en `storeSaleSchema` (teléfono mínimo 7 dígitos / enmascarado, comentarios requeridos, asesor obligatorio).
- **Incremento de versión a `1.1.3.5`.**
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-28 - Ingest: Restauración de Prefiltro Estricto de Asesores por Canal/Zona y Deselección en Tiendas

- **Formulario de Tiendas (`CreateStoreSaleForm.tsx`):**
  - Se restauró el prefiltrado estricto en `advisorOptions`, eliminando la inyección de todos los usuarios activos como fallback. El selector ahora muestra exclusivamente los asesores asignados al canal, país y departamento elegidos (o el asesor dueño si la cuenta ya existe).
  - Al cambiar canal, país o departamento, si el asesor actualmente seleccionado deja de pertenecer a los filtros elegidos, se deselecciona automáticamente (`asesor_id: ""`).
  - Se eliminó la sobreescritura de canal al seleccionar asesor, manteniendo la jerarquía determinista Canal ➔ Asesores disponibles.
- **Componente `SearchableSelect.tsx`:**
  - Se habilitó botón de limpieza rápido `✕` y toggle de deselección al re-seleccionar la opción activa (`allowClear: true`), permitiendo regresar cualquier campo a su estado sin selección.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-28 - Fix/UI: Eliminación de Validación HTML5 Nativa Estricta de Correo en Móviles (`CreateStoreSaleForm.tsx`, `UserForm.tsx`)

- **Remoción de `type="email"` nativo:**
  - Se sustituyó el atributo `type="email"` por `type="text" inputMode="email"` en los campos de entrada de correo electrónico.
  - Esto evita que los motores nativos HTML5 de navegadores móviles (iOS Safari, Android Chrome) rechacen caracteres unicode en español como la `ñ` o tildes (ej. `danna.londoño2488@gmail.com`).
- **Incremento de versión a `1.1.3.4`.**
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-28 - Fix/UI: Soporte para Correos con Caracteres Hispanos (ñ, tildes) en Formularios (`CreateStoreSaleForm.tsx`, `AccountForm.tsx`, `CreateAccountWizard.tsx`, `CreateContactWizard.tsx`)

- **Validación de Correo Electrónico Flexible:**
  - Se reemplazó la validación estricta ASCII de Zod por una expresión regular flexible `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` con `.trim()`.
  - Se habilitó soporte completo para correos electrónicos con caracteres hispanos (como `danna.londoño2488@gmail.com`) y tildes, eliminando el error *"Email inválido"*.
- **Incremento de versión a `1.1.3.3`.**
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-28 - Fix/UI: Corrección de Filtrado de Asesores sin Restricción Zonal en Creación de Cuentas y Ventas (`CreateStoreSaleForm.tsx`)

- **Formulario de Creación de Cliente / Venta (`CreateStoreSaleForm.tsx`):**
  - Se corrigió la condición de validación en `filteredAdvisors`: cuando un usuario no tiene restricciones explícitas configuradas en sus arreglos de `canales`, `paises` o `departamentos` (arreglos vacíos `[]`), la aplicación lo considera disponible para todos los canales, países y departamentos.
  - Se eliminó la falsa alarma naranja *"No hay asesores asignados para el país, departamento y canal seleccionado."* que aparecía al seleccionar ubicaciones como Antioquia/Medellín o canales como Obras.
- **Incremento de versión a `1.1.3.2`.**
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-28 - Feature/UI: Botones de Eliminación Directa y Borrado en Cascada en Cuentas, Oportunidades y Contactos (Restringido a ADMIN)

- **Control de Acceso por Rol (`isAdmin` / `userRole === 'ADMIN'`):**
  - Todas las acciones, botones y modales de eliminación en Cuentas, Oportunidades y Contactos quedaron condicionados de forma estricta para que **únicamente los usuarios con rol de Administrador (`ADMIN`)** puedan visualizarlos y ejecutarlos.
- **Módulo de Cuentas (`AccountForm.tsx`, `AccountDeleteModal.tsx`, `app/cuentas/page.tsx`):**
  - Se añadió el botón `Eliminar Cuenta` directamente en el encabezado de edición y en el pie de página (footer) de todas las pestañas del formulario de cuentas (`Información General`, `Contactos`, `Oportunidades`, `Asignado`, `Actividades`, `Sucursales`), visible solo para `ADMIN`.
  - Se actualizó `AccountDeleteModal.tsx` para permitir la eliminación directa en cascada de la cuenta junto con sus oportunidades y contactos asociados (eliminando el bloqueo artificial que exigía eliminarlos uno por uno previamente).
- **Pestaña de Oportunidades en Cuentas (`AccountOpportunitiesTab.tsx`):**
  - Se añadió botón de eliminación individual (icono de papelera) protegido por `isAdmin` para cada oportunidad listada dentro de la cuenta.
- **Módulo de Contactos (`ContactForm.tsx`):**
  - Se integró el botón `Eliminar Contacto` con `ConfirmationModal` en la barra de acciones de edición del formulario de contacto, visible solo para `ADMIN`.
- **Detalle de Oportunidades (`/oportunidades/[id]`):**
  - Se ajustó el permiso de la acción `Eliminar Oportunidad` para restringirse exclusivamente a `ADMIN`.
- **Incremento de versión a `1.1.3.1`.**
- **Páginas actualizadas:** `wiki/pages/cuentas.md`, `wiki/LOG.md`.

## 2026-08-28 - Feature/UI: Optimización Responsive de Buscadores de Productos y Supresión de Decimales en Oportunidades y Cotizaciones

- **Selector de Productos en Oportunidades (`/oportunidades/nueva` - `CreateOpportunityWizard.tsx`):**
  - Se optimizó el dropdown de búsqueda y listado de productos para pantallas móviles, asignando mayor ancho y prioridad a la descripción del artículo (`flex-1 min-w-0 pr-2 line-clamp-2`).
  - Se ajustó la jerarquía tipográfica (`text-xs sm:text-sm`) y se redujo el tamaño de los códigos de artículo (`text-[11px]`).
  - Se eliminaron los decimales en el formateo de precios (`maximumFractionDigits: 0`, `minimumFractionDigits: 0`) para reducir la carga visual y evitar truncamiento en celulares.
  - Se reorganizaron los controles de cantidad, descuento y eliminación en vista móvil en los ítems seleccionados.
- **Buscador de Productos en Cotizaciones (`/oportunidades/[id]/cotizaciones/[quoteId]`):**
  - Formateo limpio sin decimales y badge compacto para la moneda y precio.
  - Mayor espacio y legibilidad para descripciones largas de productos en dispositivos móviles.
- **Buscador de Productos en Tiendas (`CreateStoreSaleForm.tsx`):**
  - Homogeneización de formato sin decimales y layout adaptable a teclado virtual móvil.
- **Incremento de versión a `1.1.3.0`.**
- **Páginas actualizadas:** `wiki/LOG.md`.
## 2026-08-27 - Feature/Fix: Normalización Universal de Búsqueda Multi-Token, Tildes y Orden en Todos los Módulos

- **Motor de Búsqueda y Normalización (`lib/utils.ts`):**
  - Se extendió `matchesSearchTokens` para soportar tanto cadenas únicas como listas/arrays de campos (`[nombre, nit, email, asesor, etc.]`), ignorando mayúsculas/minúsculas y acentos (`removeAccents`).
  - Se añadió `getSearchTokens` para descomponer y limpiar términos de búsqueda en múltiples tokens independientes.
- **Módulos y Hooks Actualizados:**
  - `useAccountsServer.ts` & `/cuentas`: Búsqueda online/offline con tokenización de nombres y NITs, posfiltrado con `matchesSearchTokens`, y reducción de debounce a 250ms.
  - `useOpportunitiesServer.ts` & `/oportunidades`: Búsqueda cruzada por nombre de oportunidad, cuenta o asesor con tokens en cualquier orden y sin problemas de acentos.
  - `useActivitiesServer.ts` & `/actividades`: Búsqueda por asunto, descripción, oportunidad y tipo con `matchesSearchTokens`.
  - `useContactsServer.ts` & `/contactos`: Búsqueda por nombre, email, teléfono, cargo y cuenta.
  - `useProducts.ts`, `/catalogo` & `/inventarios`: Búsqueda por número de artículo, descripción, planta y familia.
  - `app/pedidos/page.tsx`: Filtrado de pedidos por número, cotización, orden de compra, cliente, oportunidad y asesor con tokens y sin tildes.
  - `SearchableSelect.tsx`: Integración de filtro personalizado con `matchesSearchTokens` en componente `<Command>`.
  - `UserList.tsx`, `UserPickerFilter.tsx`, `CreateStoreSaleForm.tsx`, `CommissionCategoryManager.tsx`, `BonusRulesManager.tsx`, `CommissionRuleForm.tsx`: Búsquedas homogéneas multi-término.
- **Incremento de versión a `1.1.2.9`.**
- **Páginas actualizadas:** `wiki/LOG.md`, `bugs-knowhow.md`.

## 2026-08-27 - Ingest: Asignación de Canal por Defecto Según Primer Canal del Asesor en Tiendas

- **Formulario de Tiendas (`/tiendas` - `CreateStoreSaleForm.tsx`):**
  - Se configuró la selección automática del canal por defecto vinculándolo al primer canal de los canales asignados al asesor (`advisor.canales[0]`).
  - Aplica en la inicialización del formulario para el usuario actual, al cambiar manualmente el asesor en el selector, y al deseleccionar o resetear la cuenta.
  - Se integró `canales` al store de sesión de usuario (`useUserStore.ts`).
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Fix: Normalización y Búsqueda Inclusiva para Listados (Gestión de Usuarios y Selectores)

- **Corrección de Filtrado Inicial en Gestión de Usuarios (`/usuarios`):**
  - La función `includesNormalized` en `lib/utils.ts` retornaba `false` cuando el query de búsqueda estaba vacío (`!searchQuery`).
  - Al iniciar `UserList` y `UserPickerFilter` con `searchTerm = ""`, todos los usuarios eran descartados por el predicado de búsqueda, mostrando `0 usuarios` en pantalla.
  - La tabla `CRM_Usuarios` carecía de política SELECT para rol `public`, retornando `[]` en consultas del cliente antes o durante la hidratación de sesión auth.
- **Solución:**
  - Se actualizaron `includesNormalized` y `matchesSearchTokens` en `lib/utils.ts` para retornar `true` ante consultas vacías o con espacios en blanco.
  - Se reforzó `UserList.tsx` y `UserPickerFilter.tsx` con evaluación explícita `!searchTerm.trim() || ...`.
  - Se creó y aplicó la política RLS `"Allow read access to public for CRM_Usuarios"` (migración `20260826_allow_public_read_crm_usuarios.sql`).
- **Páginas actualizadas:** `wiki/LOG.md`, `bugs-knowhow.md`.

## 2026-08-26 - Ingest: Filtrado de Columnas Generadas en Sincronización (CRM_CotizacionItems.subtotal)

- **Corrección de Error en Sincronización al Eliminar Oportunidades:**
  - Al eliminar oportunidades o cotizaciones, las mutaciones de soft-delete (`_complete_snapshot_`) de `CRM_CotizacionItems` encoladas incluían la propiedad `subtotal`.
  - Como `subtotal` es una columna generada en PostgreSQL (`is_generated = 'ALWAYS'`), el motor SQL rechazaba la operación con `column "subtotal" can only be updated to DEFAULT`.
- **Solución a Nivel Base de Datos y Cliente:**
  - Se actualizó el RPC `public.process_field_updates` en Supabase/PostgreSQL para comprobar `is_generated` en `information_schema.columns` y omitir cualquier columna con `is_generated = 'ALWAYS'` en inserciones y actualizaciones.
  - Se actualizó `lib/sync.ts` para sanitizar payloads snapshot de `CRM_CotizacionItems` en `pushChanges` y `queueMutation`.
  - Se limpió el encolado de soft-delete en `deleteOpportunity` (`lib/hooks/useOpportunities.ts`) y `deleteAccount` (`lib/hooks/useAccounts.ts`).
  - Migración aplicada: `supabase/migrations/20260826_fix_process_field_updates_generated_columns.sql`.
- **Páginas actualizadas:** `wiki/pages/sincronizacion-offline.md`, `wiki/LOG.md`, `bugs-knowhow.md`.

## 2026-08-26 - Ingest: Flexibilización de Campos y Autogeneración de Asunto en Actividades

- **Obligatoriedad de Fechas:**
  - `fecha_inicio` es obligatoria únicamente para actividades de tipo `TAREA` (Fecha de Vencimiento).
  - Para `EVENTO`, tanto `fecha_inicio` como `fecha_fin` pasan a ser opcionales en creación y edición.
- **Subclasificación Opcional:** Se retiró el requisito obligatorio de `subclasificacion_id` para permitir guardar actividades sin necesidad de seleccionar un subnivel.
- **Autogeneración Dinámica de Asunto (`asunto`):**
  - Si el usuario deja el campo vacío o en blanco, se genera automáticamente con la estructura `[Clasificación] - [Oportunidad o Cuenta]`.
  - Si no hay oportunidad ni cuenta asociada, usa solo la clasificación.
  - Se vinculó a los cambios de selección en clasificación, oportunidad y cuenta, y como fallback garantizado en `handleActualSubmit` y `onAutoSave`.
- **Páginas actualizadas:** `wiki/pages/actividades.md`, `wiki/LOG.md`.

## 2026-08-26 - Ingest: Blindaje de Calidad y Robustez del Formulario de Tiendas (/tiendas)

- **Asignación de Propietario (`useAccounts.ts` & `CreateStoreSaleForm.tsx`):** `createAccount` ahora respeta `owner_user_id` pasado en el payload, asignando el cliente nuevo directamente al asesor seleccionado (evitando que quede asignado al usuario logueado en caso de registro por coordinadores/administradores). Para cuentas existentes sin asesor, se actualiza el propietario en Dexie/Supabase.
- **Sincronización Dinámica de Precios e Inventario:** El efecto reactivo de recálculo al alternar la casilla "Venta de Feria" ahora actualiza tanto precios como `inventario_disponible` en tiempo real desde el mapa de inventario.
- **Edición de Cantidades Fluida:** Se corrigió el comportamiento del input de cantidad permitiendo borrar dígitos con retroceso sin forzar `NaN` o `1` prematuro antes del `onBlur`.
- **Resumen Visual de Valor Total:** Se añadió una tarjeta en la sección de productos que muestra el conteo total de unidades y el monto total en COP (`watch("amount")`) con distintivo de precios de feria si aplica.
- **Reserva de Feria Defensiva:** Llamada a `reserveFairInventory` envuelta en bloque `try/catch` defensivo para no interrumpir el registro ni la creación de la actividad en caso de intermitencia de red.
- **Reseteo de Fase al Cambiar Canal:** Al cambiar el canal de venta, se resetea la fase a la primera fase válida del nuevo canal.
- **Corrección de Arreglos en RPC (`public.process_field_updates`):**
  - **Causa Raíz:** Al enviar `contactos_ids: []` (arreglo de UUIDs) en mutaciones snapshot (`_complete_snapshot_`), PostgreSQL intentaba castear el texto `($2->>'contactos_ids')::_uuid`, el cual generaba el string `"[]"` con corchetes en lugar de llaves `{}` de PostgreSQL, arrojando el error `malformed array literal: "[]"`.
  - **Solución y Refinamiento:** Se actualizó la función `public.process_field_updates` en Supabase/PostgreSQL para detectar columnas de tipo arreglo usando `LEFT(v_col_type, 1) = '_'` (evitando el comodín de SQL `LIKE '_%'` que capturaba `varchar` como `archar`) y construir el arreglo nativo mediante `jsonb_array_elements_text()` y `array_agg(elem::base_type)` con fallback seguro a `ARRAY[]::base_type[]`.
  - **Efecto Cascada:** Al desbloquearse la inserción de la oportunidad y la actualización de cuentas, se resuelve automáticamente el fallo en `CRM_Cuentas` y `CRM_Actividades`.
  - **Migración creada:** `supabase/migrations/20260826_fix_process_field_updates_array_types.sql`.
- **Incremento de versión a `1.1.2.8`.**
- **Páginas actualizadas:** `wiki/LOG.md`, `package.json`.

## 2026-08-26 - Ingest: Blindaje Integral y Fallbacks Universales en Formulario Tiendas (/tiendas)

- **Auditoría Completa y Prevención Permanente (`CreateStoreSaleForm.tsx`, `bugs-knowhow.md`):**
  - Se blindó todo el esquema Zod y el handler `onSubmit` con fallbacks defensivos para todas las secciones (Cuenta, Oportunidad, Actividad y Subclasificación).
  - Imposibilidad matemática de errores de validación de campos bloqueados o condicionales.
  - Documentado en `bugs-knowhow.md` como estándar de ingeniería para el repositorio.
  - Incremento de versión a `1.1.2.7`.
- **Páginas actualizadas:** `wiki/LOG.md`, `package.json`, `bugs-knowhow.md`.

## 2026-08-26 - Ingest: Desbloqueo y Opcionalidad Total de Subclasificación y Canal (/tiendas)

- **Edición Rápida y Eliminación de Bloqueos en Subclasificación (`CreateStoreSaleForm.tsx`):**
  - Se eliminaron todos los candados `disabled` en Subclasificación y Canal de Venta para todos los usuarios.
  - El campo `subclasificacion_id` es completamente opcional, editable de forma instantánea y se eliminaron las alertas de error asociadas.
  - Fallback automático determinístico en `onSubmit` si se deja vacío.
  - Incremento de versión a `1.1.2.6`.
- **Páginas actualizadas:** `wiki/LOG.md`, `package.json`.

## 2026-08-26 - Ingest: Filtrado Estricto de Productos de Feria Disponibles (/tiendas)

- **Corrección de Búsqueda y Disponibilidad en Venta de Feria (`CreateStoreSaleForm.tsx`):**
  - Al marcar "Venta de feria", el buscador de productos ahora filtra de forma estricta únicamente aquellos ítems que tienen `precio_feria > 0` y existencia disponible positiva (`disponible > 0`) en el inventario de feria.
  - Al abrir o enfocar el buscador con "Venta de feria" activo, despliega directamente el catálogo de productos disponibles en feria (ej. hidromasaje Mobu con existencia física/disponible), ocultando ítems sin inventario o ajenos a la feria.
  - Incremento de versión a `1.1.2.5`.
- **Páginas actualizadas:** `wiki/LOG.md`, `package.json`.

## 2026-08-26 - Ingest: Contacto Colapsado por Defecto y Asesor Automático (/tiendas)

- **Mejoras de Usabilidad en Tiendas-Ferias (`CreateStoreSaleForm.tsx`):**
  - La sección "Contacto del Cliente" ahora permanece **cerrada/colapsada por defecto** (`isContactExpanded = false`) para evitar confusiones y recaptura redundante de datos.
  - El "Asesor Encargado del Cliente" se autoselecciona con el usuario autenticado activo por defecto, evitando el error *"El asesor es obligatorio"*.
  - Sincronización en tiempo real del nombre de la oportunidad al escribir el nombre del cliente.
  - Incremento de versión a `1.1.2.4` para forzar invalidación de caché PWA en móviles.
- **Páginas actualizadas:** `wiki/LOG.md`, `package.json`.

## 2026-08-26 - Ingest: Nombre de Oportunidad Opcional con Autogeneración (/tiendas)

- **Desbloqueo de Campo Nombre de Oportunidad (`CreateStoreSaleForm.tsx`):**
  - Se eliminó la obligatoriedad de `nombre_oportunidad` en el esquema Zod y en la interfaz de usuario.
  - Si el asesor o usuario deja el campo vacío, el sistema genera automáticamente el nombre en formato `Venta - [Nombre de la Cuenta]` (o `Venta en Tienda` si es cliente genérico), permitiendo guardar registros sin interrupciones.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Corrección Definitiva Validación Subclasificación (/tiendas)

- **Eliminación de Error Falso "Subclasificación requerida" (`CreateStoreSaleForm.tsx`):**
  - En React Hook Form con Zod, los campos con atributos condicionales o vinculados enviaban valor omitido disparando el error `"Subclasificación requerida"`.
  - Se flexibilizó el esquema Zod (`storeSaleSchema`) para `subclasificacion_id`, `canal_id`, `pais_id` y `telefono`, resolviendo los valores de forma determinística en `onSubmit` tanto para cuentas nuevas como existentes vinculadas.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Desbloqueo y Edición de Cuentas Vinculadas para Administradores (/tiendas)

- **Permisos de Administrador en Formulario Tiendas-Ferias (`CreateStoreSaleForm.tsx`):**
  - Los usuarios con rol `ADMIN` (como Mayerly Marín) ahora tienen desbloqueo y edición total de todos los campos al vincular cuentas existentes (NIT, Teléfono, Email, Canal, Subclasificación, Ubicación y Asesor).
  - Se eliminó el enmascaramiento con `*****` para administradores, cargando los datos legibles reales.
  - Se implementó fallback inteligente de subclasificación por canal y desbloqueo de campos vacíos en cuentas incompletas para evitar bloqueos por validación ("Subclasificación requerida").
  - Sincronización automática de cambios sobre la cuenta vinculada al enviar el formulario si es admin o si se completaron datos faltantes.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Robustez y Corrección en Módulo Inventarios (/inventarios)

- **Corrección de Render y Manejo Defensivo (`InventoryManager.tsx`):**
  - Se previno el error de conexión/render en React mediante validaciones nulas para `operation`, `meta`, `Icon` y `movement.producto`.
  - Manejo seguro de arrays o joins simples devueltos por PostgREST para `producto:CRM_ListaDePrecios`.
  - Carga optimizada de existencias activas globales (`useInventorySummary`) con feedback visual de carga independiente (`isLoadingMovements`).
  - Depuración de precios de feria en Supabase (99 productos oficiales).
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Corrección de Guardado de Clientes Existentes, Subclasificación Opcional y Clientes Atendidos por Defecto (= 1) en /tiendas

- **Selección de Cuenta Existente y Defaults (`CreateStoreSaleForm.tsx` & `CreateOpportunityWizard.tsx`):**
  - **Clientes Atendidos por Defecto (= 1):** Se fijó el valor por defecto de `clientes_atendidos` en `1` (en lugar de `0`) en la inicialización, reseteo, vinculación de cuentas y selección de contactos (mínimo 1) en `/tiendas` y en el wizard de oportunidades.
  - **Subclasificación 100% Opcional:** Se flexibilizó el esquema Zod a opcional/nullable (`subclasificacion_id: z.string().optional().nullable()`), se agregó opción vacía por defecto (`Seleccionar (Opcional)...`), se eliminó la auto-asignación forzada y se desbloquea el campo si la cuenta seleccionada carece de subclasificación.
  - **Asesor por Defecto (Luis Guillermo Escobar):** Si la cuenta existente no tiene asesor asignado (`owner_user_id` nulo/vacío), se asigna por defecto a Luis Guillermo Escobar (`bc4209dd-cf19-4a97-b4c5-ed8d11d94965` / `luis.escobar@firplak.com`), permitiendo además seleccionarlo o modificarlo en la interfaz en lugar de bloquearlo.
  - **Captura de Errores de Validación (`onInvalid`):** Se agregó callback a `handleSubmit(onSubmit, onInvalid)` para mostrar feedback explícito al usuario en caso de que algún campo obligatorio no esté completo.
- **Páginas actualizadas:** `wiki/LOG.md`.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Optimización Móvil y Desplegables con Búsqueda en Tiendas-Ferias (/tiendas)

- **Desplegable de Asesor con Búsqueda (`SearchableSelect.tsx` & `CreateStoreSaleForm.tsx`):**
  - Se sustituyó el `<select>` tradicional de "Asesor Encargado del Cliente *" por el componente `SearchableSelect`.
  - Permite buscar asesores en tiempo real por nombre/correo, con soporte móvil, bloqueo visual al vincular cuentas existentes (`Lock`), y filtrado reactivo por canal, país y departamento.
- **Desplegables `MultiSelect` (Categorías y Contactos):**
  - Ajuste de anchura dinámica en móviles (`w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] min-w-[260px]`), evitando desbordamientos de pantalla.
  - Filtro por etiqueta textual exacta (`value={option.label}`) en `CommandItem`, resolviendo búsquedas en español.
  - Altura táctil (`min-h-[42px]`), tamaño de texto preventivo contra zoom automático en iOS (`text-base sm:text-sm`) y `overscroll-contain`.
- **Buscador de Cuentas y Buscador de Productos (`CreateStoreSaleForm.tsx`):**
  - Cierre reactivo al tocar/hacer clic afuera soportando eventos táctiles (`touchstart` y `mousedown`).
  - Botones de acción rápida `✕` para limpiar texto de búsqueda en un solo toque.
  - Manejo de estados vacíos y feedback visual táctil (`active:bg-slate-100`, `cursor-pointer`).
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Reorganización de Campos y Flujo de Captura en Formulario Tiendas-Ferias (/tiendas)

- **Reordenamiento de Campos Prioritarios:** Se reestructuró `CreateStoreSaleForm.tsx` para colocar al inicio de la interfaz los 5 campos de captura rápida esenciales para atención en mostrador o feria:
  1. `nombre_cuenta` (Nombre de la Cuenta / Cliente *) con autocompletado y vinculación.
  2. `telefono` (Teléfono *) con detección preventiva de duplicados.
  3. `email` (Email Opcional) con detección preventiva de duplicados.
  4. `categoria_oportunidad` (Categorías de Interés Opcional) con `MultiSelect`.
  5. `comentarios` (Comentarios * de la oportunidad).
- **Secciones Reorganizadas:**
  - **Datos de Ubicación y Cuenta:** Cédula/NIT, Canal de Venta, Subclasificación, País, Departamento, Ciudad, Asesor Encargado del Cliente y Dirección.
  - **Contacto del Cliente:** Bloque colapsable con selección múltiple de contactos existentes, clientes atendidos y datos opcionales de nuevo contacto.
  - **Datos del Negocio (Oportunidad):** Nombre de Oportunidad, Fase, Origen, Checkbox de Venta de Feria y Buscador/Lista de Productos.
  - **Actividad Programada:** Bloque colapsable con Clasificación, Prioridad, Vencimiento y Comentarios.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-26 - Ingest: Catálogo de Productos - Filtro Completo y Eliminación de Límites Arbitrarios

- **Catálogo de Productos (`/catalogo`, `CatalogPage.tsx`):**
  - Se eliminó el truncamiento a 300 productos cuando se aplican filtros de disponibilidad o búsqueda.
  - El filtro "Solo disponibles" ahora consulta la totalidad de registros con existencia/disponibilidad en `CRM_InventarioDisponible` (`disponible > 0`) y carga la lista completa de productos disponibles sin cortes arbitrarios.
  - Se optimizó `useProductSearch` (`lib/hooks/useProducts.ts`) agregando soporte para opciones avanzadas (`onlyFeria`, `productIds`, `limit: 10000`) para consultas del catálogo completo y filtros por planta, familia y feria.
  - Se optimizó `fetchInventorySummary` (`lib/hooks/useInventory.ts`) para consultar selectivamente los registros con movimientos o disponibilidad activa.
- **Páginas actualizadas:** `wiki/LOG.md`.

## 2026-08-25 - Ingest: Optimización Responsive Móvil y Selección de Fila en Listados (Oportunidades, Cuentas, Contactos, Usuarios)

- **Módulos Cuentas, Contactos y Oportunidades:**
  - **Vista móvil:** Implementación de tarjetas interactivas adaptadas para dispositivos móviles con badges de estado, valores formateados, avatares y accesos directos.
  - **Vista desktop (Handsontable):** Unificación de la interacción mediante clic/selección directa de fila para editar o navegar al detalle (eliminando la columna de botones manuales de acción en tabla a favor de un flujo más limpio).
- **Módulo Usuarios (`/usuarios`, `UserList.tsx`):**
  - **Vista móvil:** Tarjetas responsivas con badges de rol (`ROLE_LABELS`, `ROLE_COLORS`), estado activo/inactivo, chips de canales de venta asignados (`canales`) y botones de acción rápida para editar y alternar estado.
  - **Vista desktop:** Tabla responsiva tradicional con detalle de roles, estado y canales autorizados.
- **Páginas actualizadas:** `wiki/pages/oportunidades.md`, `wiki/pages/cuentas.md`, `wiki/pages/contactos.md`, `wiki/pages/roles-y-permisos.md`, `wiki/LOG.md`.

## 2026-08-25 - Ingest: Filtro por Origen (`origen_oportunidad`) en el Módulo Oportunidades

- **Componente Filtros (`OpportunityFilters.tsx`):** Se integró el selector de "Origen" alimentado dinámicamente desde el catálogo `CRM_OrigenesOportunidad` (ordenado por `orden, nombre`), con soporte para limpiar filtros y sincronización de estado.
- **Hook de Servidor (`useOpportunitiesServer.ts`):** Soporte para `originFilter`, filtrado en consultas online (Supabase `.ilike()` y soporte para aliases como WhatsApp/wp) y filtrado en motor offline (Dexie). Inclusión de `origen_oportunidad` en las consultas `select`.
- **Página de Oportunidades (`app/oportunidades/page.tsx`):** Sincronización bidireccional del filtro `origin` con URL (`searchParams`) y `sessionStorage`, y visualización de la columna "Origen" en la tabla desktop (Handsontable).
- **Páginas actualizadas:** `wiki/pages/oportunidades.md`, `wiki/LOG.md`.

## 2026-08-25 - Ingest: Múltiples Contactos Vinculados y Clientes Atendidos en Oportunidades (/tiendas y CRM)

- **Migración Supabase y Modelo:** Nuevas columnas `contactos_ids uuid[]` y `clientes_atendidos integer` en `CRM_Oportunidades` (`20260825_add_opportunity_contacts_and_attended_clients.sql`) y en `LocalOportunidad` (`lib/db.ts`).
- **Formulario /tiendas (`CreateStoreSaleForm.tsx`):** Sección de contacto habilitada de forma permanente y 100% opcional (para clientes nuevos y existentes). En cuentas existentes se despliega un `MultiSelect` prefiltrado con los contactos de la cuenta seleccionada (`account_id`), el cual actualiza dinámicamente el contador del campo numérico editable `Clientes atendidos`.
- **Soporte Global en Oportunidades:** Integración de `contactos_ids` y `clientes_atendidos` en el wizard `/oportunidades/nueva` (`CreateOpportunityWizard.tsx`) y en el detalle `/oportunidades/[id]` (`app/oportunidades/[id]/page.tsx` - `SummaryTab`).
- **Páginas actualizadas:** `wiki/pages/oportunidades.md`, `wiki/pages/modelo-de-datos.md`, `wiki/LOG.md`.

## 2026-08-25 - Ingest: Soporte de Selección Múltiple de Categorías en Oportunidades (Todo el CRM)

- **Módulo Central de Categorías (`lib/opportunityCategories.ts`):** Definición de categorías canónicas (`Baños`, `Cocinas`, `Zona de Labores`, `Hidromasajes`, `Institucional`), con utilidades bidireccionales `parseOpportunityCategories` (normaliza strings/arrays) y `formatOpportunityCategories` (serializa a string delimitado por comas).
- **Módulo /tiendas (`CreateStoreSaleForm.tsx`):** Reemplazo del `<select>` simple por `<MultiSelect>`, guardado automático de múltiples categorías en `categoria_oportunidad` y concatenación descriptiva en comentarios.
- **Wizard de Oportunidades (`CreateOpportunityWizard.tsx`):** Selector múltiple `MultiSelect` en el paso 2 de datos del negocio y persistencia en `categoria_oportunidad`.
- **Detalle de Oportunidad (`app/oportunidades/[id]/page.tsx`):** Reemplazo del input de texto plano por `MultiSelect` con auto-guardado reactivo al modificar selecciones.
- **Modelo Local y Edge Functions:** Soporte en `LocalOportunidad` (`lib/db.ts`) y normalización en `wordpress-lead-intake`.
- **Pruebas Automatizadas:** 7 tests unitarios en `tests/opportunityCategories.test.ts`.
- **Páginas actualizadas:** `wiki/pages/oportunidades.md`, `wiki/LOG.md`.

## 2026-08-25 - Fix: Campo Nombre de Oportunidad Obligatorio en Formulario de Tiendas (/tiendas)

- **Campo Obligatorio:** Se incorporó el input `nombre_oportunidad` como obligatorio (`z.string().min(1, "Nombre de la oportunidad requerido")`) en la sección "Datos del Negocio (Oportunidad)" de `CreateStoreSaleForm.tsx`.
- **Auto-sugerencia:** Al vincular una cuenta existente se auto-completa como valor inicial sugerido `Venta - [Nombre Cuenta]`, permitiendo su edición libre antes de guardar.

## 2026-08-25 - Fix: Cédula / NIT Opcional en Formulario de Tiendas (/tiendas)

- **Ajuste de Validación:** Se modificó `nit_base` en `storeSaleSchema` (`CreateStoreSaleForm.tsx`) para ser opcional (`z.string().optional().nullable()`), removiendo la restricción obligatoria y el asterisco del campo en la UI.
- **Creación Segura de Cuenta:** Si `nit_base` no es diligenciado, se envía como `undefined` al motor de cuentas sin bloquear el registro de la venta ni la detección preventiva de duplicados por teléfono o email.

## 2026-08-25 - Fix: Eliminación de FERIA como Canal de Venta Estructural

- **Restablecimiento de los 5 Canales Canónicos:** Se eliminó `FERIA` de `SALES_CHANNELS` (`lib/salesChannels.ts`) y de `CRM_Canales`. Los canales estructurales de venta quedan exclusivamente en `PROPIO`, `DIST_NAC`, `DIST_INT`, `OBRAS_NAC` y `OBRAS_INT`.
- **Tratamiento de Ferias:** Las ferias se manejan como origen de oportunidad comercial (`origen_oportunidad = 'Feria'`) y las tarifas especiales mediante la bandera `venta_feria = true` (`precio_feria` en `getProductPrice`).
- **Limpieza en /tiendas (`CreateStoreSaleForm.tsx`):** Se eliminó la validación redundante `selectedChannel === "FERIA"`, operando con `isFairSale`.
- **Migración DB (`20260825_remove_feria_as_channel.sql`):** Reasignación de cuentas `canal_id = 'FERIA'` a `PROPIO`, eliminación de fases/subclasificaciones huérfanas de `FERIA`, depuración de `CRM_Usuarios.canales`, y registro de 'Feria' en `CRM_OrigenesOportunidad`.
- **Tests & Wiki:** Actualización de `tests/salesChannels.test.ts`, `wiki/pages/canales-de-venta.md`, `wiki/pages/modelo-de-datos.md` y `wiki/LOG.md`.

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
