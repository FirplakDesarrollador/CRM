# Cuentas

Las cuentas (`/cuentas`, tabla `CRM_Cuentas`) son las empresas/clientes. Cada cuenta
pertenece obligatoriamente a un [[canales-de-venta|canal de venta]] (`canal_id NOT NULL`),
que determina su lista de precios.

## Campos clave

- **Identificación:** `nombre`, `nit`, `nit_base` (para agrupar sucursales; si se omite al crear o editar, se autogenera un NIT alfanumérico provisional único `PROV-XXXXXXXX` mediante `lib/nitUtils.ts`; cuando se digita un NIT real en cuenta raíz, el input sanitiza en vivo y solo permite números con un único guion y dígito de verificación opcional `/^\d{5,12}(-\d)?$/`, sin puntos ni espacios; al crear una sucursal se permite además el indicativo `#` y se autogenera automáticamente como `<NIT_PADRE>#2` o siguiente consecutivo vía `get_next_branch_nit` / `buildBranchNit`, ej. `900510728-6#2`),
  `id_cuenta_principal` (jerarquía casa matriz → sucursales; el índice `unique_active_nit` aplica solo a cuentas raíz y `isValidRealNit` acepta `#N` para formalizar pedidos).
- **Canal:** `canal_id` (obligatorio) + `subclasificacion_id` opcional por canal
  (migraciones `20260119_subclassifications`, `20260212_add_propio_subclassifications`).
- **Propietario:** `owner_user_id` (`20260218_add_account_owner.sql`), usado también por RLS.
- **Nivel premium:** `es_premium` + `nivel_premium` jerárquico
  (`PREMIUM` > `DESTACADO` > `ACTIVO`), migración `20260113_premium_clients`.
- **Origen de la cuenta:** `origen_cuenta` (opcional de texto, ej. Referido, Feria, Publicidad, Web, etc., migración `20260820_add_origen_cuenta.sql`).
- **Descuentos:** `ignorar_limites_descuento` permite saltar los límites de descuento por
  volumen en cotizaciones (ver [[cotizaciones-y-pedidos]]).
- **Geografía:** `pais_id` / `departamento_id` / `ciudad_id` contra catálogos de Colombia
  (más el campo texto legado `ciudad`).

## UI

- Creación mediante `app/cuentas/nueva/CreateAccountWizard.tsx`: wizard de 3 pasos
  (información base, ubicación/contacto con origen_cuenta, y clasificación). La cuenta solo se crea
  desde el último paso con `Crear Cuenta`; el submit está protegido contra avances
  o doble clics que intenten saltarse la clasificación. Mientras el asesor digita el nombre o el NIT en el Paso 1, el RPC `SECURITY DEFINER` `search_similar_accounts` (`pg_trgm` + `unaccent` + raíz numérica de NIT) muestra en vivo cuentas similares de toda la base sin exponer teléfono ni correo ajenos, ofreciendo por fila el botón **Crear cuenta nueva en mi sucursal** (que vincula a la cuenta matriz, hereda NIT/canal y autogenera el nombre `{Nombre Matriz} - {Zona del vendedor}` usando `CRM_Usuarios.zona_id`) o **Abrir cuenta** si ya pertenece al mismo asesor. Si el asesor continúa digitando un nombre o NIT con alta coincidencia, se muestran tags persistentes de alerta (`lib/accountSimilarity.ts`). Al guardar, los duplicados exactos o de raíz de NIT bloquean con `DuplicateAccountModal` (con acción rápida de crear sucursal), y las altas coincidencias de nombre o NIT solicitan confirmación explícita (`ConfirmationModal`) advirtiendo que se notificará a la coordinación comercial; si el asesor continúa, se inserta automáticamente una notificación (`SIMILAR_ACCOUNT_CREATED`) en `CRM_Notifications` para sus coordinadores asignados (o coordinadores activos).
- Prueba E2E dev-only en `/e2e/cuentas-wizard` para validar el wizard sin depender
  de cookies de Supabase; en producción la ruta devuelve 404.
- Listado con filtros (`AccountFilters`, `UserPickerFilter`): vista móvil con tarjetas responsivas y vista desktop con tabla interactiva (Handsontable) donde la columna "País" (mapeada dinámicamente desde `pais_id` / catálogos) se visualiza en la vista inicial junto a Ubicación, y la edición se activa directamente al hacer clic/seleccionar la fila.
- Detalle con pestañas: contactos, oportunidades, actividades, sucursales (branches), asignados e **Historial de Cambios** (`components/cuentas/Account*Tab.tsx` y `EntityAuditHistoryTab`). La reasignación de responsable desde la cuenta matriz reasigna automáticamente en cascada todas sus oportunidades vinculadas en un traspaso directo. La reasignación desde una oportunidad individual aplica únicamente a esa oportunidad.
- Formulario `AccountForm` con pestañas (usa `shouldUnregister: false` — ver
  `bugs-knowhow.md` §1), botón de eliminación visible en el encabezado y en los footers de todas las pestañas, y pestaña de **Historial** (`activeTab === 'history'`) que muestra todas las modificaciones de nombre, NIT, canal, teléfono, dirección o propietario auditadas en tiempo real. Utiliza `lastSyncedAccountIdRef` y `lastSyncedUpdatedAtRef` para garantizar que el `useEffect` de sincronización con la propiedad `account` no sobreescriba los cambios guardados tras el submit (`isDirty = false`). Tanto en `AccountForm` como en `CreateAccountWizard`, la selección de **Cuenta Principal (Padre)** usa `components/accounts/ParentAccountCombobox.tsx` (búsqueda en vivo contra Supabase por nombre o NIT con paginación y fallback offline a Dexie, sin el tope previo de 100 registros), y todos los demás desplegables (Canal, Subclasificación, País, Departamento, Ciudad, Comercial Asignado y Filtros) usan `SearchableSelect`.
- Carga masiva de cuentas: `BulkAccountUploader` + API `app/api/bulk-accounts`.
- Borrado (`delete_account` / `AccountDeleteModal`): funcionalidad restringida estrictamente a usuarios con rol `ADMIN` (`isAdmin`), con modal de confirmación que permite borrado en cascada de la cuenta junto con sus contactos y oportunidades asociadas (además de permitir borrado individual de registros relacionados).

## Auditoría

`CRM_HistorialModificaciones` (respaldada por el trigger `trg_audit_account_changes_full`) registra de forma automática y append-only cualquier modificación en nombre, NIT, teléfono, canal, dirección, ciudad y propietario (`owner_user_id`), asociando el ID y nombre del usuario responsable. La tabla histórica previa `CRM_Audit_Cuentas` se preserva como referencia histórica.

## Relaciones

- 1:N con [[contactos]], [[oportunidades]] y [[actividades]]
  (`20260309_add_account_to_activities` liga actividades directamente a cuentas).
- Las reglas de [[comisiones]] pueden apuntar a cuentas específicas
  (`commission_rules_multi_accounts`).

## Fuentes

- `app/cuentas/page.tsx`, `components/cuentas/`
- `app/cuentas/nueva/CreateAccountWizard.tsx`
- `app/e2e/cuentas-wizard/page.tsx`, `e2e/create_account_wizard.spec.ts`,
  `playwright.e2e.config.ts`
- `lib/hooks/useAccounts.ts`, `useAccountsServer.ts`, `lib/db.ts` (interfaz `LocalCuenta`), `lib/nitUtils.ts`, `lib/accountSimilarity.ts`
- Migraciones: `20260108_sales_channels`, `20260113_premium_clients`, `20260119_subclassifications`, `20260218_add_account_owner`, `20260820_add_origen_cuenta`, `20260821_backfill_account_origin_from_opportunities`, `20261126152500_account_similarity_zones_and_branches`, `20261126175000_branch_nit_hash_suffix`
