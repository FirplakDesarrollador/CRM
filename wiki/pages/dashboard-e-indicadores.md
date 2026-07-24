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
Permisos `view_reports` / `view_team_reports` / `export_reports` (ver [[roles-y-permisos]]).

- **Filtros Avanzados por Entidad:**
  - **Oportunidades:** Rango fechas creación, asesor, canal, estado, fase, segmento, origen, rango de valor ($ min/max) y departamento/ciudad.
  - **Cuentas:** Rango fechas creación, asesor asignado, canal, tipo cliente premium/VIP y departamento/ciudad.
  - **Contactos:** Rango fechas creación, asesor/creador y cargo/rol de decisión.
  - **Cotizaciones:** Rango fechas creación, asesor, estado (DRAFT, SENT, WINNER, REJECTED, EXPIRED) y rango de valor ($ min/max).
  - **Actividades:** Rango fechas creación, rango fechas vencimiento (`fecha_fin`), asesor, estado cumplimiento (completadas/pendientes), tipo actividad, clasificación y subclasificación.
  - **Informe S&OP:** Reporte pre-diseñado para la planificación de ventas y producción.
    - **Filtros S&OP:** Asesor, canal, estado, año/mes comercial, planta (PC, ALM, FVH), familia de producto, probabilidad mínima (%), quincena (1ª/2ª) y tipo de registro (pedidos/proyectado).
    - **Lógica de Fechas y Pedidos Parciales:** Extrae el Año, Mes Planta y Mes Comercial en español. Considera fraccionamiento por entregas parciales: si una Oportunidad tiene pedidos (`CRM_Pedidos`), consolida por ítems (`CRM_PedidoItems`) con fecha de facturación (`"EXTRA_Fecha de facturación"`) y fecha de entrega (`"EXTRA_Fecha mínima requerida por comercial/cliente"`). Si no tiene pedidos, proyecta a partir de `fecha_cierre_estimada` y su cotización.
    - **Formato Excel:** Genera dos pestañas: la sábana de datos planos (`S&OP`) y la tabla de contingencia dinámica (`TD`), maquetada con `exceljs`.

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
