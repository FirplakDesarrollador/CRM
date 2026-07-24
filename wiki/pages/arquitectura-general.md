# Arquitectura General

El CRM Firplak es una aplicación web **offline-first** para la gestión comercial de Firplak
(fabricante colombiano de productos para baño y cocina). Está construida como PWA sobre
Next.js con Supabase como backend, y una base de datos local IndexedDB (Dexie) que permite
trabajar sin conexión y sincronizar después.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router) + React 18 + TypeScript |
| UI | Tailwind CSS, Radix UI, lucide-react, ECharts (gráficos) |
| Estado | Zustand (stores), TanStack React Query, react-hook-form + Zod |
| Base de datos local | Dexie (IndexedDB) — espejo de las tablas del servidor |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| PWA / offline | @ducanh2912/next-pwa + [[sincronizacion-offline]] propia |
| Exportación | exceljs / xlsx (Excel), jspdf + autotable (PDF, ver [[cotizaciones-y-pedidos]]) |

## Principios de diseño

1. **Offline-first:** toda lectura/escritura pasa primero por Dexie; un `SyncEngine`
   con patrón *outbox* replica los cambios campo a campo hacia Supabase con resolución
   de conflictos LWW (Last-Write-Wins). Ver [[sincronizacion-offline]].
2. **Seguridad por roles:** matriz de permisos centralizada en `lib/permissions.ts`
   (roles ADMIN / COORDINADOR / VENDEDOR) + RLS en todas las tablas de Supabase.
   Ver [[roles-y-permisos]].
3. **Nomenclatura de tablas:** todas las tablas del servidor llevan prefijo `CRM_`
   (`CRM_Cuentas`, `CRM_Oportunidades`, `CRM_Cotizaciones`, ...). Ver [[modelo-de-datos]].
4. **Lógica de negocio en la base de datos:** las reglas críticas (comisiones, precios por
   canal, embudo de ventas) viven en funciones RPC y triggers de PostgreSQL, no en el cliente.

## Módulos principales (navegación del sidebar)

| Módulo | Ruta | Página wiki |
|---|---|---|
| Inicio (Dashboard) | `/` | [[dashboard-e-indicadores]] |
| Oportunidades | `/oportunidades` | [[oportunidades]] |
| Cuentas | `/cuentas` | [[cuentas]] |
| Contactos | `/contactos` | [[contactos]] |
| Actividades | `/actividades` | [[actividades]] |
| Pedidos | `/pedidos` | [[cotizaciones-y-pedidos]] |
| Comisiones | `/comisiones` | [[comisiones]] |
| Indicadores | `/indicadores` | [[dashboard-e-indicadores]] |
| Tiendas-Ferias | `/tiendas` | formulario integrado de cuenta, oportunidad, actividad y reservas de feria |
| Catálogo | `/catalogo` | lista de precios por canal con búsqueda flexible e inventario |
| Inventarios | `/inventarios` (solo ADMIN) | movimientos de entrada, salida y reserva |
| Informes | `/informes` (solo ADMIN) | [[dashboard-e-indicadores]] |
| Usuarios | `/usuarios` (solo ADMIN) | [[roles-y-permisos]] |
| Configuración | `/configuracion` | metas, notificaciones, comisiones, cargas masivas |

La visibilidad de módulos por usuario se controla con el campo `allowed_modules` del usuario
además del rol (ver [[roles-y-permisos]]).

## Integraciones externas

Microsoft Graph (correo, calendario, Planner), ForceManager (CRM legado), SAP (cola de
integración de pedidos) y WordPress (captura de leads web). Detalle en [[integraciones]].

## Fuentes

- `package.json` (stack y versión de la app)
- `components/layout/Sidebar.tsx` (módulos de navegación)
- `lib/db.ts`, `lib/sync.ts` (offline-first)
- `lib/permissions.ts` (roles)
- `supabase/schema.sql`, `supabase/migrations/` (backend)
