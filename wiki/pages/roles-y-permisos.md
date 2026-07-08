# Roles y Permisos

El control de acceso tiene tres capas: matriz de permisos en el cliente
(`lib/permissions.ts`), RLS en PostgreSQL, y filtrado de módulos visibles por usuario
(`allowed_modules`).

## Roles

| Rol | Alcance |
|---|---|
| **ADMIN** | Acceso completo: gestión de usuarios, todas las oportunidades/actividades, ajustes de comisión, categorías, informes. |
| **COORDINADOR** | Todo excepto gestión de usuarios (`manage_users`). Ve todas las oportunidades y actividades, aprueba cotizaciones, gestiona reglas de comisión, exporta reportes. |
| **VENDEDOR** | Solo sus propias oportunidades y actividades. Puede crear/editar cuentas, contactos y cotizaciones; ve solo sus comisiones y reportes propios. No borra nada. |

## Matriz de permisos

Los permisos son strings tipados (`Permission`) agrupados por dominio: oportunidades,
cuentas, contactos, actividades, cotizaciones, reportes, configuración y comisiones.
Helpers: `hasPermission(role, p)`, `hasAnyPermission`, `hasAllPermissions`,
`getRolePermissions`. En la UI se aplica con `components/auth/PermissionGuard.tsx`.

Distinciones clave:

- `view_own_*` vs `view_all_*`: VENDEDOR solo tiene las `own`; COORDINADOR y ADMIN tienen ambas.
- `delete_account` es exclusivo de ADMIN; COORDINADOR puede borrar contactos, actividades, oportunidades y cotizaciones, pero no cuentas.
- `approve_quote`: COORDINADOR y ADMIN.
- `manage_commission_categories` y `create_commission_adjustment`: exclusivos de ADMIN.

## Visibilidad de módulos

- El Sidebar filtra por rol (`/usuarios` e `/informes` requieren ADMIN) y por el array
  `allowed_modules` del usuario (`20260120_add_allowed_modules.sql`), lo que permite
  ocultar módulos a usuarios específicos sin cambiar su rol.
- ADMIN siempre ve todo.

## Coordinadores y jerarquía

La migración `20260205_add_coordinators.sql` añade la relación vendedor→coordinador,
usada para reportes de equipo y como destinatario en [[notificaciones]] (opción
"Coordinador / Gerente").

## RLS (Row Level Security)

Habilitado en todas las tablas (`20260213_enable_rls_all_tables.sql`), con arreglos
posteriores para propietarios de cuenta (`20260218_fix_rls_owner`) y actividades
(`20260428_fix_activities_rls`). La propiedad de registros usa `owner_user_id` /
`created_by`.

## Autenticación

Supabase Auth (login en `/login`, callback en `app/auth/callback`, recuperación en
`/update-password`). `useCurrentUser` expone usuario + rol; el rol se normaliza al store
de UI como ADMIN / COORDINATOR / SALES.

## Fuentes

- `lib/permissions.ts` (matriz completa comentada)
- `lib/hooks/useCurrentUser.ts`, `components/auth/PermissionGuard.tsx`
- `components/layout/Sidebar.tsx` (filtrado de módulos)
- Migraciones: `20260120_add_allowed_modules`, `20260205_add_coordinators`, `20260213_enable_rls_all_tables`
