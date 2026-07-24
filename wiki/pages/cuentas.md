# Cuentas

Las cuentas (`/cuentas`, tabla `CRM_Cuentas`) son las empresas/clientes. Cada cuenta
pertenece obligatoriamente a un [[canales-de-venta|canal de venta]] (`canal_id NOT NULL`),
que determina su lista de precios.

## Campos clave

- **Identificación:** `nombre`, `nit`, `nit_base` (para agrupar sucursales),
  `id_cuenta_principal` (jerarquía casa matriz → sucursales).
- **Canal:** `canal_id` (obligatorio) + `subclasificacion_id` opcional por canal
  (migraciones `20260119_subclassifications`, `20260212_add_propio_subclassifications`).
- **Propietario:** `owner_user_id` (`20260218_add_account_owner.sql`), usado también por RLS.
- **Nivel premium:** `es_premium` + `nivel_premium` jerárquico
  (`PREMIUM` > `DESTACADO` > `ACTIVO`), migración `20260113_premium_clients`.
- **Descuentos:** `ignorar_limites_descuento` permite saltar los límites de descuento por
  volumen en cotizaciones (ver [[cotizaciones-y-pedidos]]).
- **Geografía:** `pais_id` / `departamento_id` / `ciudad_id` contra catálogos de Colombia
  (más el campo texto legado `ciudad`).

## UI

- Creación mediante `app/cuentas/nueva/CreateAccountWizard.tsx`: wizard de 3 pasos
  (información base, ubicación/contacto y clasificación). La cuenta solo se crea
  desde el último paso con `Crear Cuenta`; el submit está protegido contra avances
  o doble clics que intenten saltarse la clasificación.
- Prueba E2E dev-only en `/e2e/cuentas-wizard` para validar el wizard sin depender
  de cookies de Supabase; en producción la ruta devuelve 404.
- Listado con filtros (`AccountFilters`, `UserPickerFilter`), vista de galería de tarjetas premium responsiva en desktop y mobile. Columna de acciones editar/eliminar solo para ADMIN.
- Detalle con pestañas: contactos, oportunidades, actividades, sucursales (branches) y
  asignados (`components/cuentas/Account*Tab.tsx`).
- Formulario `AccountForm` con pestañas (usa `shouldUnregister: false` — ver
  `bugs-knowhow.md` §1).
- Carga masiva de cuentas: `BulkAccountUploader` + API `app/api/bulk-accounts`.
- Borrado solo ADMIN (`delete_account`), con modal de confirmación `AccountDeleteModal`.

## Auditoría

`CRM_Audit_Cuentas` registra cambios (creada en la migración de canales
`20260108_sales_channels.sql`).

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
- `lib/hooks/useAccounts.ts`, `useAccountsServer.ts`, `lib/db.ts` (interfaz `LocalCuenta`)
- Migraciones: `20260108_sales_channels`, `20260113_premium_clients`, `20260119_subclassifications`, `20260218_add_account_owner`
