# Oportunidades

Módulo central del CRM (`/oportunidades`): representa los negocios en curso. Cada
oportunidad pertenece a una [[cuentas|cuenta]], tiene un vendedor propietario, avanza por
**fases** que dependen del [[canales-de-venta|canal de venta]], y contiene
[[cotizaciones-y-pedidos|cotizaciones]] y [[actividades]].

## Ciclo de vida

- **Creación:** wizard en `/oportunidades/nueva` (`CreateOpportunityWizard`).
- **Categorías de Interés Múltiples:** La oportunidad admite selección de una o múltiples categorías comerciales (`Baños`, `Cocinas`, `Zona de Labores`, `Hidromasajes`, `Institucional`) mediante `MultiSelect` en el wizard (`/oportunidades/nueva`), en el detalle (`/oportunidades/[id]`), en `/tiendas` y en el intake de WordPress. Se normaliza mediante `lib/opportunityCategories.ts` (`parseOpportunityCategories` / `formatOpportunityCategories`) y se almacena como string delimitado por comas compatible con PostgreSQL y Dexie (`categoria_oportunidad`).
- **Contactos Vinculados y Clientes Atendidos:** La oportunidad almacena `contactos_ids` (`uuid[]` en Supabase / `string[]` en Dexie) para asociar uno o más contactos de la cuenta (`CRM_Contactos`) a la negociación, y `clientes_atendidos` (`integer` en Supabase / `number` en Dexie). En `/tiendas`, la sección de contacto permanece siempre activa y opcional; si se elige una cuenta existente, se muestra un `MultiSelect` prefiltrado con sus contactos que auto-contabiliza `clientes_atendidos` (campo editable por el usuario). Ambos campos están integrados en el wizard `/oportunidades/nueva` y en el detalle `/oportunidades/[id]`.
- **Origen configurable:** `CRM_OrigenesOportunidad` define las opciones administrables desde Configuración; Tiendas-Ferias y el detalle de oportunidad consumen ese catálogo.
- **Fases por canal:** cada canal tiene su propio conjunto de fases
  (migraciones `obras_nac_phases`, `obras_int_phases`, `dist_nac_phases`,
  `dist_int_phases`, `propio_phases`). Las fases viven en `CRM_FasesOportunidad`.
- **Estados:** `CRM_EstadosOportunidad` (p. ej. "Contacto Inicial" = id 8, usado por el
  lead intake de WordPress — ver [[integraciones]]).
- **Probabilidad:** campo añadido en `20260202_add_probability.sql`.
- **Fecha de Entrega:** Campo `fecha_entrega` (`DATE` nullable) registrado en `CRM_Oportunidades` (migración `20261016000000_add_fecha_entrega_to_oportunidades.sql`) para estimar y coordinar los despachos desde la oportunidad. Editable inline con guardado automático en `/oportunidades/[id]` en la grilla junto a "Fecha Cierre Estimada" y "Moneda", seleccionable en el wizard `/oportunidades/nueva` y exportable a Excel en `/informes`.
- **Cierre perdido:** requiere motivo de pérdida (`20260205_loss_reasons.sql`,
  `LossReasonModal.tsx`).
- **Cierre ganado:** la cotización marcada `is_winner` dispara el cálculo de
  [[comisiones]] vía trigger.

## Colaboradores

Una oportunidad puede tener colaboradores además del propietario
(`CRM_OportunidadColaboradores`, `CollaboratorsTab`/`CollaboratorSelector`). Los
colaboradores participan en el reparto de [[comisiones]]
(`20260211_update_commission_logic_collaborators.sql`). Soft-delete con `is_deleted`.

**Filtro "Colaboración":** 
En `/oportunidades`, el filtro o pestaña "Colaboración" incluye ahora **todas** las oportunidades que involucren un esquema compartido para el usuario activo:
1. Oportunidades donde el usuario es colaborador.
2. Oportunidades que el usuario creó (es propietario) y a las que agregó colaboradores.

## Transferencias

Las oportunidades pueden transferirse entre vendedores (permiso `transfer_opportunity`,
solo COORDINADOR/ADMIN); el historial queda en `CRM_TransferenciasOportunidad`.

## Detalle de oportunidad

`/oportunidades/[id]` con pestañas: información, cotizaciones
(`/oportunidades/[id]/cotizaciones/[quoteId]`), actividades, colaboradores, asignados.
`OpportunityQuickView` ofrece vista rápida desde listados.

- **Información de Negocio:** En la tarjeta principal de negocio, el campo **Categorías de Interés** (`categoria_oportunidad` con `MultiSelect`) está ubicado inmediatamente antes de **Valor de la Oportunidad (Importe)** para agilizar la calificación comercial de las líneas de producto (Baños, Cocinas, Hidromasajes, etc.) antes de registrar o editar el valor de la negociación.

## Interfaz y Listado

- **Columna de Actividades (`lib/opportunityActivities.ts`):** En la vista general (desktop y móvil), cada oportunidad muestra el estado y conteo de sus actividades vinculadas:
  - **Atrasada (Rojo):** Badge rojo con conteo de actividades vencidas pendientes (`!is_completed && fecha_fin < now`).
  - **Programada (Azul):** Badge azul con conteo de actividades agendadas a futuro (`!is_completed && fecha_fin >= now`).
  - **Completada (Verde):** Badge verde cuando todas las actividades asociadas están al día.
  - **Sin actividad:** Indicador tenue cuando la oportunidad no registra tareas ni eventos.
- **Formato de Moneda y Separadores (`lib/utils.ts`):** Todos los valores de oportunidad (en el encabezado `DetailHeader`, tarjetas de importe, previsualización de entradas manuales, vista rápida `OpportunityQuickView` y listados) aplican el formato estándar de Colombia (`es-CO`: punto para miles, coma para decimales, ej. `COP 152.266.785,2`) mediante `formatNumberCO` y `formatOpportunityAmount`.
- **Vista móvil:** Tarjetas responsivas con detalles de la cuenta (País, Ciudad, Canal), badges de fase, estado, indicador de actividad, valor en COP, cierre estimado, avatar del vendedor y acceso directo al detalle.
- **Vista desktop:** Tabla interactiva (Handsontable) que inicia con la columna **OPORTUNIDAD** (nombre del negocio), seguida de **CUENTA**, **ACTIVIDAD**, **PAÍS**, **CIUDAD** y **CANAL**, con soporte de redimensionamiento manual (`manualColumnResize`), selector de columnas visibles (`ALL_COLUMNS`), ordenamiento dinámico por cabecera y filtrado directo desde cabeceras. Al hacer clic en el botón de filtro `[▼]` de las cabeceras (**Canal**, **Fase**, **Vendedor / Asignado a**, **Estado**, **Origen**, **País**, **Ciudad**, **Creada** y **Cierre**), se intercepta el menú genérico de Handsontable (que únicamente conocía las primeras 100 filas en memoria) y se despliegan paneles popover flotantes especializados:
  - `FloatingColumnFilterPopover`: Consulta en tiempo real los catálogos maestros de Supabase (`CRM_Canales`, `CRM_FasesOportunidad`, `CRM_Usuarios`, `CRM_OrigenesOportunidad`, `CRM_Paises` y búsqueda por ciudad) sin traer las 60.000 oportunidades a memoria. Muestra todas las opciones posibles de la base de datos y, al seleccionar una opción, envía la consulta al backend (`useOpportunitiesServer`: `setChannelFilter`, `setPhaseFilter`, `setAccountOwnerIds`, `setStatusFilter`, `setOriginFilter`, `setCountryFilter`, `setCityFilter`), cargando progresivamente los resultados filtrados reales de Supabase.
  - `FloatingColumnFilterPopover`: Panel inteligente anclado a las cabeceras de columnas (**Canal**, **Fase**, **Vendedor**, **Estado**, **Origen**, **País**, **Ciudad**). En la columna **Fase**, restringe las opciones estrictamente al canal comercial asignado/seleccionado (`selectedChannel` o `CRM_Usuarios.canales`), deduplica nombres de etapas repetidas en BD (resolviendo IDs equivalentes con `getEquivalentPhaseIds`), excluye estados cerrados ("Cerrada Ganada" / "Cerrada Perdida" pertenecientes a ESTADO) e integra la opción directa para filtrar "Prospectos (Sin fase)" (`fase_id IS NULL`). Si el usuario no ha filtrado por canal, el popover le permite escoger su canal comercial con un clic.
  - `FloatingDateFilterPopover`: Panel intuitivo para columnas de fecha (**Creada** y **Cierre**) con opciones directas ("Hasta la fecha / Anteriores a hoy", "Hoy", "Últimos 7 días", "Últimos 30 días", "Este mes", "Año actual", selector de rango personalizado y opción de traer todos los datos históricos).
  - Todas las columnas filtradas muestran el indicador visual `🔵` en la cabecera mediante `formatColumnHeaderTitle` e `isColumnFilterActive`.
- **Filtros Rápidos de Fecha (`QuickDateFilter`):** En la barra superior de herramientas de `/oportunidades`, se cuenta con un selector de filtros rápidos con opciones idénticas y sincronizadas ("Hasta la fecha / Anteriores a hoy", "Hoy", "Últimos 7 días", "Últimos 30 días", "Este mes", "Año actual", y rango personalizado con fechas inicio/fin). Incluye la opción de "Traer todos los datos (incluir ganadas y perdidas)" cambiando `statusFilter` de `'open'` a `'all'` para consultar la totalidad del histórico del CRM en Supabase.
- **Carga Progresiva y Conteo de Totales Desacoplado (`useOpportunitiesServer.ts`, `lib/opportunityColumnFilterHelpers.ts`):**
  - **Paginación progresiva (`pageSize = 30`):** La vista general renderiza un lote inicial rápido de 30 oportunidades (<200 ms), eliminando esperas y congelamientos de interfaz. Conforme el usuario se desplaza, `useInfiniteScroll` solicita los siguientes lotes de 30 ítems sin bloquear Handsontable ni la vista móvil.
  - **Consulta de Totales en Paralelo (`head: true`):** En `useOpportunitiesServer.ts`, el conteo total exacto (`count`) se desacopló por completo de la consulta de filas y joins de actividades. Se ejecuta una petición `HEAD` ultraligera indexada (`select('id', { count: 'exact', head: true })`) que evalúa en **11-13 ms** sin transferir datos de fila, únicamente en el render inicial o al cambiar filtros. Durante el desplazamiento por scroll (`loadMore`), el conteo se omite, garantizando una paginación continua sin lag.
  - **Métricas de Totales en Tiempo Real (`calculateTotalAmount`):** El hook calcula y expone `totalAmount` sumando los montos cargados. El pie de tabla en desktop muestra `Mostrando X de Y oportunidades | Total valor cargado: $ ...`, y la vista móvil lo presenta en su cabecera superior.
- **Detalle de la Oportunidad (`app/oportunidades/[id]/page.tsx`):** Vista de gestión comercial completa organizada en pestañas: Información del negocio, Productos/Cotizaciones, Actividades, Colaboradores y **Historial de Cambios** (`EntityAuditHistoryTab`). La pestaña de Historial expone cronológicamente quién modificó la oportunidad (fase, estado, propietario/vendedor, importe, motivo de pérdida, fechas estimadas), con badge de usuario resuelto, fecha/hora exacta en Colombia y comparador visual tachado rojo (valor anterior) $\rightarrow$ verde negrita (valor nuevo).

## Visibilidad

VENDEDOR solo ve las suyas (`view_own_opportunities`); COORDINADOR/ADMIN ven todas.
Ver [[roles-y-permisos]]. Filtros por vendedor, canal, subclasificación, segmento, fase, estado, fechas y origen (`origen_oportunidad` vía `CRM_OrigenesOportunidad`) en `OpportunityFilters.tsx`; búsqueda sincronizada con la URL (⚠️ patrón anti-bucle
documentado en `bugs-knowhow.md` §6).

## Embudo de ventas

El dashboard consume RPCs de embudo (`get_sales_funnel_rpc`, versión filtrada, y fix de
agrupación por fase `20260304`) que agrupan oportunidades por fase. Ver
[[dashboard-e-indicadores]].

## Notas operativas

- `CreateOpportunityWizard` usa `LAST_STEP_INDEX` y una ventana corta de habilitacion para impedir que un doble clic al avanzar cree la oportunidad antes de revisar el ultimo paso de Equipo.
- **Campo Setter (`setter`):** Campo opcional para clasificar el origen de prospección comercial de la oportunidad con opciones `CO` y `REC` (o `null` por defecto / Ninguna). Ubicado en la tarjeta de Setter en la vista de detalle de oportunidad ([`app/oportunidades/[id]/page.tsx`](file:///c:/Users/analista2.desarrollo/Desktop/apps/CRM/app/oportunidades/[id]/page.tsx)). Al diligenciarse, se exporta automáticamente en la columna **SETTER** del informe de oportunidades en Excel/CSV (`/informes`).
- **Prevención de Duplicados (Base de datos):** Se implementó un trigger (`trigger_prevent_duplicate_oportunidades`) que lanza una excepción bloqueando la inserción si se detecta otra oportunidad creada hace menos de 10 segundos con el mismo `account_id` y `nombre`. Esto previene la creación de "clones exactos" por errores de red, reintentos de API o clics múltiples.
- **Sincronización Inmediata de Importe (`lib/opportunityQuoteSync.ts`):** El valor de la oportunidad (`CRM_Oportunidades.amount`) se sincroniza de forma atómica e inmediata cada vez que se crea una cotización, se agregan/editan productos en una cotización (`updateQuoteTotal`), o se alterna entre cotizaciones en la pestaña **Productos** (`resolveActiveQuote`). La cotización `WINNER` tiene precedencia absoluta; si no hay ganadora, la cotización activa define el importe.
- **Protocolo Estándar de Migración/Homologación desde vTiger (`directives/migracion_completa_oportunidades_vtiger.md` / `execution/migrate_vtiger_opportunities.mjs`):**
  1. *Fases Canal Propio:* 0% $\rightarrow$ NULL; 10% $\rightarrow$ Primer contacto; 20-30% $\rightarrow$ Presentación de propuesta; 40% $\rightarrow$ Acuerdo de precios; 50% $\rightarrow$ Negociación final; 60% $\rightarrow$ Esperando pedido; 80%/Ganada/Pedido Enviado $\rightarrow$ Cerrada ganada; Cerrada perdida/Prospecto frío $\rightarrow$ Cerrada Perdida.
  2. *Fechas de Cierre:* ISO `YYYY-MM-DD` estricto desde `vtiger_potential.closingdate`.
  3. *Tipo de Cliente / Cargo:* Homologación simultánea entre `CRM_Contactos.cargo` y `CRM_Cuentas.subclasificacion_id` (Arquitecto = 19, Cliente final = 17, Decoradores = 18, Carpintero = 20).
  4. *Bitácora y Comentarios:* Extracción completa de `vtiger_modcomments` concatenados cronológicamente `[YYYY-MM-DD]` + `description` original. En pérdida, poblar `comentarios_perdida` y razón pareto.
  5. *Actividades Históricas:* Migración de `vtiger_activity` a `CRM_Actividades` con fechas/horas exactas, tipo de actividad y estado completado.
  6. *Categorías Comerciales:* Normalización de `cf_1152` a `Hidromasajes`, `Baños`, `Cocinas`, `Zona de Labores`, `Institucional`.
  7. *Correos:* Propagación bidireccional entre contactos y cuentas.
  8. *Sincronización PWA:* Siempre actualizar `updated_at = NOW()` en todas las entidades modificadas.

## Fuentes

- `app/oportunidades/` (páginas), `components/oportunidades/`, `components/opportunities/`
- `lib/hooks/useOpportunities.ts`, `useOpportunitiesServer.ts`, `useSalesFunnel.ts`, `lib/opportunityQuoteSync.ts`
- Migraciones: fases por canal (`202601xx`), `20260202_add_probability`, `20260205_loss_reasons`, `20260211_add_opportunity_collaborators`
