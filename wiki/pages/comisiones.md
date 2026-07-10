# Comisiones

Motor de comisiones para vendedores (`/comisiones`), implementado casi por completo en
PostgreSQL (migraciones `20260210`–`20260212` + ajustes posteriores). Calcula la comisión
cuando una [[cotizaciones-y-pedidos|cotización]] se marca ganadora (`is_winner`) y la
registra en un **ledger** auditable.

## Regla de oro: "lowest wins"

Entre todas las reglas de comisión que aplican a una venta, **gana el porcentaje MÁS
BAJO**, sin importar la especificidad de la regla
(`20260210_commission_logic_lowest_wins.sql`). El desempate secundario sí usa la
especificidad (más específica primero). El `priority_score` se conserva solo como
referencia/snapshot.

## Componentes

- **Reglas (`/comisiones/reglas`):** dimensiones de match (canal, categoría, cuenta(s)
  específicas — `commission_rules_multi_accounts` —, rango de fechas de vigencia).
  Gestión vía `CommissionRuleForm`/`CommissionRuleTable` y carga masiva con
  `CommissionRulesUploader`. Defaults en `20260417_commission_defaults`.
- **Categorías (`/comisiones/categorias`):** categorías de producto para comisiones
  (`commission_categories`, pobladas en `populate_categories`; gestión solo ADMIN).
- **Ledger (`/comisiones/ledger`):** asiento por venta con snapshot de la regla aplicada;
  ajustes manuales vía `CommissionAdjustmentModal` (permiso
  `create_commission_adjustment`, solo ADMIN).
- **Bonos:** reglas de bonos (`useBonusRules`, `BonusRulesManager`, RLS en
  `20260212_add_bonus_rules_rls_policies`).
- **Dashboard (`/comisiones`):** `CommissionDashboard` con vista por vendedor
  (`useVendorCommissions`, `useCommissionDashboard`).

## Disparo y reparto

- **Trigger:** al marcar `is_winner` en una cotización
  (`commission_trigger_quotes` + `HOTFIX_is_winner`).
- **Colaboradores:** el reparto considera a los colaboradores de la
  [[oportunidades|oportunidad]] (`20260211_update_commission_logic_collaborators`).
- **Lógica de pago:** `20260211_commission_payment_logic`; correcciones consolidadas en
  `20260212_consolidated_commission_fix` y remediación en `20260211_remediate_commission`.

## Permisos

- VENDEDOR: solo `view_own_commissions`.
- COORDINADOR: ver todas + `manage_commission_rules`.
- ADMIN: todo, incluidas categorías y ajustes. Ver [[roles-y-permisos]].

## Fuentes

- `app/comisiones/` (dashboard, reglas, categorías, ledger)
- `components/comisiones/`, `lib/hooks/useCommission*.ts`, `useBonusRules.ts`, `useVendorCommissions.ts`
- Migraciones `20260210_commission_*`, `20260211_*`, `20260212_*`, `20260417_commission_defaults`
