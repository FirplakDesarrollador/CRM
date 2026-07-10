# Dashboard, Indicadores, Informes y Metas

Capa analítica del CRM: dashboard de inicio (`/`), indicadores (`/indicadores`),
informes exportables (`/informes`, solo ADMIN) y metas (`/configuracion/metas`).

## Dashboard de inicio (`/`)

Grilla de tiles (`DashboardGrid`) con filtros globales (`DashboardFilters`,
`useDashboardFilters`):

- **Embudo de ventas** (`SalesFunnelTile`): RPC `get_sales_funnel` (con variante
  filtrada y fix de agrupación por fase `20260304`) sobre [[oportunidades]].
- **Resumen de oportunidades** (`OpportunitySummaryCard`).
- **Objetivos** (`ObjectivesCard`): avance frente a metas.
- **Distribución de clientes** (`ClientDistributionTile`) y **cuentas recientes**
  (`RecentAccounts`).
- **Gráfico de desempeño** (`PerformanceChartTile`, ECharts).

## Indicadores (`/indicadores`)

Tiles de KPI como ventas ganadas (`VentasGanadasTile`).

## Informes (`/informes`, solo ADMIN)

Reportes exportables a Excel (`exceljs`/`xlsx`, utilidades en `lib/utils/informes.ts`).
Permisos `view_reports` / `view_team_reports` / `export_reports`
(ver [[roles-y-permisos]]).

- **Informe S&OP:** Reporte pre-diseñado para la planificación de ventas y producción.
  - **Lógica de Fechas y Pedidos Parciales:** Extrae de forma automática el Año, Mes Planta y Mes Comercial en español. Considera el fraccionamiento de fechas por entregas parciales: si una Oportunidad tiene pedidos creados (`CRM_Pedidos`), se consolida la información a nivel de ítems de pedido (`CRM_PedidoItems`), tomando las fechas de facturación (Comercial) y entrega (Planta) de cada pedido parcial. Si no tiene pedidos, se proyecta globalmente a partir de la `fecha_cierre_estimada` de la Oportunidad y su cotización activa/ganadora.
  - **Formato Excel:** Genera un archivo con dos pestañas: la sábana de datos planos (`S&OP`) y una tabla de contingencia resumen de canales contra meses comerciales (`TD`), utilizando `exceljs` para maquetación y formato de contabilidad.

## Metas (Goals)

- Tabla de metas por usuario con fecha límite
  (`20260127_create_goals_table`, `20260127_add_goal_due_date`).
- **Expiración automática:** las metas vencidas sin cumplir se marcan fallidas
  (`20260127_auto_fail_expired_goals`).
- Gestión en `/configuracion/metas` (`GoalsConfigModal`, `GoalsList`,
  `GoalDetailModal`); el avance alimenta `ObjectivesCard` del dashboard.

## Fuentes

- `app/(dashboard)/page.tsx`, `components/dashboard/`, `components/indicadores/`
- `app/informes/page.tsx`, `lib/utils/informes.ts`
- `app/configuracion/metas/page.tsx`, `components/config/Goals*.tsx`
- `lib/hooks/useSalesFunnel.ts`, `useDashboardFilters.ts`, `useConfig.ts`
- Migraciones `20260127_*goals*`, `20260210/20260223_sales_funnel_rpc`
