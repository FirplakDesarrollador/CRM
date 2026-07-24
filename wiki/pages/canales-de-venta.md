# Canales de Venta

Los 5 canales de venta (`CRM_Canales`, migración `20260108_sales_channels.sql`) son la
columna vertebral del negocio: determinan la **lista de precios**, las **fases de
oportunidad** y la **subclasificación** de cada cuenta.

## Los 5 canales (inmutables)

| ID | Nombre | Columna de precio (`CRM_ListaDePrecios`) |
|---|---|---|
| `OBRAS_NAC` | Obras Nacional | `lista_base_obras` |
| `OBRAS_INT` | Obras Internacional | `lista_base_exportaciones` |
| `DIST_NAC` | Distribución Nacional | `lista_base_cop` |
| `DIST_INT` | Distribución Internacional | `lista_base_exportaciones` |
| `PROPIO` | Canal Propio (B2C) | `distribuidor_pvp_iva` |

## Efectos del canal

1. **Precio:** funciones de pricing en la DB resuelven el precio de un producto según la
   columna del canal de la cuenta. Ver [[cotizaciones-y-pedidos]].
2. **Fases:** cada canal tiene su propio pipeline de fases de [[oportunidades]]
   (migraciones `obras_nac_phases`, `obras_int_phases`, `dist_nac_phases`,
   `dist_int_phases`, `propio_phases`).
3. **Cuentas:** `canal_id` es obligatorio en [[cuentas]]; el default de backfill fue
   `DIST_NAC`. Subclasificaciones por canal (`20260119`, `20260212_add_propio_subclassifications`).
4. **Canal PROPIO (B2C):** recibe los leads del sitio WordPress
   (ver [[integraciones]]) y crea [[contactos]] automáticamente
   (`20260202_auto_contact_propio`).

## Fuentes

- `supabase/migrations/20260108_sales_channels.sql`
- `supabase/crm_lista_precios.sql`, `supabase/fix_lista_precios.sql`
- Migraciones de fases por canal (`20260109`–`20260112`)
