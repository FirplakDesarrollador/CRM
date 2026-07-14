# Oportunidades

Módulo central del CRM (`/oportunidades`): representa los negocios en curso. Cada
oportunidad pertenece a una [[cuentas|cuenta]], tiene un vendedor propietario, avanza por
**fases** que dependen del [[canales-de-venta|canal de venta]], y contiene
[[cotizaciones-y-pedidos|cotizaciones]] y [[actividades]].

## Ciclo de vida

- **Creación:** wizard en `/oportunidades/nueva` (`CreateOpportunityWizard`).
- **Fases por canal:** cada canal tiene su propio conjunto de fases
  (migraciones `obras_nac_phases`, `obras_int_phases`, `dist_nac_phases`,
  `dist_int_phases`, `propio_phases`). Las fases viven en `CRM_FasesOportunidad`.
- **Estados:** `CRM_EstadosOportunidad` (p. ej. "Contacto Inicial" = id 8, usado por el
  lead intake de WordPress — ver [[integraciones]]).
- **Probabilidad:** campo añadido en `20260202_add_probability.sql`.
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

## Visibilidad

VENDEDOR solo ve las suyas (`view_own_opportunities`); COORDINADOR/ADMIN ven todas.
Ver [[roles-y-permisos]]. Filtros por vendedor, canal, fase, estado en
`OpportunityFilters.tsx`; búsqueda sincronizada con la URL (⚠️ patrón anti-bucle
documentado en `bugs-knowhow.md` §6).

## Embudo de ventas

El dashboard consume RPCs de embudo (`get_sales_funnel_rpc`, versión filtrada, y fix de
agrupación por fase `20260304`) que agrupan oportunidades por fase. Ver
[[dashboard-e-indicadores]].

## Notas operativas

- `CreateOpportunityWizard` usa `LAST_STEP_INDEX` y una ventana corta de habilitacion para impedir que un doble clic al avanzar cree la oportunidad antes de revisar el ultimo paso de Equipo.
- **Prevención de Duplicados (Base de datos):** Se implementó un trigger (`trigger_prevent_duplicate_oportunidades`) que lanza una excepción bloqueando la inserción si se detecta otra oportunidad creada hace menos de 10 segundos con el mismo `account_id` y `nombre`. Esto previene la creación de "clones exactos" por errores de red, reintentos de API o clics múltiples.

## Fuentes

- `app/oportunidades/` (páginas), `components/oportunidades/`, `components/opportunities/`
- `lib/hooks/useOpportunities.ts`, `useOpportunitiesServer.ts`, `useSalesFunnel.ts`
- Migraciones: fases por canal (`202601xx`), `20260202_add_probability`, `20260205_loss_reasons`, `20260211_add_opportunity_collaborators`
