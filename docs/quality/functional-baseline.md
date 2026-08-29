# Linea base funcional y de calidad

Fecha de descubrimiento: 2026-08-28. Estado Git inicial: limpio (`git status --short` sin salida). No se hicieron llamadas a proveedores, escrituras de produccion ni despliegues.

## Arquitectura descubierta

CRM web instalable/PWA construido con Next.js 16 y React 18. Supabase aporta autenticacion, PostgreSQL, RLS, RPC y Edge Functions. El navegador mantiene una replica parcial en IndexedDB/Dexie con outbox, reintentos, dead letters y sincronizacion incremental. Hay integraciones remotas con Microsoft Graph, SAP/ForceManager, Power Automate, Power BI, WordPress y workflows n8n. Los roles de aplicacion son `ADMIN`, `COORDINADOR` y `VENDEDOR`; la UI filtra permisos, pero la frontera real declarada es RLS.

## Matriz de evidencia funcional

| Capacidad | Actor | Entrada y resultado | Datos / permisos | Dependencias | Control existente | Estado y evidencia |
|---|---|---|---|---|---|---|
| Login, callback y recuperacion | Usuario | `/login`, `/auth/callback`, `/update-password`; crea/renueva sesion | Cookies Supabase; rutas privadas | Supabase Auth | Middleware `proxy.ts` | INFERRED: redireccion y sesion visibles; sin contrato Auth E2E |
| Dashboard e indicadores | Roles autenticados | `/`, `/indicadores`; embudo, metas y Power BI | Cuentas, oportunidades, actividades; filtrado por rol | Supabase RPC, Power BI | Pruebas placeholder sin casos | UNVERIFIED: `app/(dashboard)/page.tsx`, `app/indicadores/page.tsx` |
| Cuentas y asignacion | Vendedor/coordinador/admin | `/cuentas`, `/cuentas/nueva`; CRUD y propietario | `CRM_Cuentas`; permisos y RLS | Dexie, Supabase | Spec del wizard; sin contrato RLS | INFERRED: `lib/hooks/useAccounts.ts`, `e2e/create_account_wizard.spec.ts` |
| Contactos e importacion vCard | Usuario autorizado | `/contactos`; CRUD, duplicados e importacion | `CRM_Contactos`, relacion con cuenta | Dexie, Supabase, Contacts API | Un caso trivial y un fallo intencional | BROKEN/UNVERIFIED: `pruebas unitarias/contactos.test.ts` |
| Oportunidades y colaboradores | Vendedor/coordinador/admin | `/oportunidades`; crear, filtrar, detalle y colaboracion | `CRM_Oportunidades*`; ownership | Dexie, Supabase/RLS | 4 casos de permisos colaboradores, categorias | VERIFIED solo en logica pura: `tests/opportunityCollaboratorPermissions.test.ts` |
| Cotizaciones y pedidos | Comercial | Detalle de oportunidad/cotizacion y `/pedidos`; formalizar y editar items | Cotizaciones, pedidos e items; importes y campos SAP | Dexie, RPC sync, SAP | 3 casos de formalizacion | INFERRED: `lib/pedidoFormalization.ts`, prueba asociada |
| Actividades y checklist | Comercial | `/actividades`; agenda, checklist, autosave | `CRM_Actividades`; propietario/asignados | Dexie, Microsoft Calendar/Planner | 2 specs de harness UI | INFERRED hasta ejecutar gate: `e2e/*activity*.spec.ts` |
| Sincronizacion offline | Usuario autenticado | Operaciones locales; compacta outbox, reintenta y recupera dead letters | Replica Dexie y tablas CRM permitidas | IndexedDB, Supabase RPC/RLS | 11 casos enfocados verdes | VERIFIED en logica determinista: `lib/sync-*.test.ts`, `lib/hooks/useFormAutoSave.test.tsx` |
| Comisiones | Admin/coordinador/vendedor | `/comisiones`; reglas, categorias, ledger y dashboard | Tablas/RPC de comision; visibilidad por rol | Supabase triggers/RPC | Archivo placeholder sin casos | UNVERIFIED: `components/comisiones/*`, migraciones 20260210-12 |
| Catalogo, inventario, tiendas y ferias | Comercial/admin | `/catalogo`, `/inventarios`, `/tiendas`; consulta y venta | Catalogos, precios, inventario | Supabase, Dexie | 1 caso de prioridad de precio de feria | INFERRED: `tests/salesChannels.test.ts`, migracion 20260716 |
| Configuracion y usuarios | Admin/coordinador | `/configuracion`, `/usuarios`; metas, origenes, usuarios y permisos | Catalogos, `CRM_Usuarios`; rol | Supabase/RLS | Placeholder sin casos | UNVERIFIED: `components/config/*`, `components/usuarios/*` |
| Importacion masiva de cuentas | Usuario autenticado autorizado | `POST /api/bulk-accounts`; valida y crea lotes | Cuentas y catalogos | Supabase | Auth server-side; sin prueba de contrato | INFERRED: `app/api/bulk-accounts/route.ts` |
| Microsoft Calendar/Planner/email | Usuario con OAuth | `/api/microsoft/**`; crea/actualiza/busca eventos, tareas y correo | Tokens por usuario y actividad | Microsoft Graph, Supabase | Auth en rutas; contrato externo separado | UNVERIFIED: rutas API; `qa:contract:microsoft` parcial/manual |
| Ingreso de leads WordPress | Sistema WordPress | Edge Function; crea cuenta, contacto y oportunidad | Service role; secreto compartido | WordPress, Supabase | Validacion de secreto en codigo | INFERRED: `supabase/functions/wordpress-lead-intake/index.ts`; sin prueba |
| Notificaciones vencidas | Cron/Edge Function | Funcion programada; busca vencidas y notifica | Actividades/usuarios | Supabase, Power Automate | Documentacion operativa | UNVERIFIED: `supabase/functions/check-overdue-activities/index.ts` |
| Workflows n8n | Operador/automatizacion | Workflows TS sincronizados a n8n Cloud | Facturas, CRM, MySQL, Supabase | n8n y proveedores | Protocolo n8n-as-code; fuera de QA app | UNVERIFIED en este trabajo; no se editaron nodos |

## Linea base previa a la adopcion

| Comando exacto | Exit / duracion | Ejecutado | Resultado honesto |
|---|---|---|---|
| `npm run test:sync` | 0 / 6.256 s | 3 archivos, 11 casos | 11 pasaron; 0 fallaron/omitidos |
| `npm run typecheck:sync` | 0 / 6.236 s | `tsconfig.sync.json` | Sin errores en el subconjunto de sync |
| `npm run lint` | 1 / ~75 s | Repositorio sin alcance acotado | Miles de hallazgos; incluyo `.claude/worktrees`, `n8n-mcp` y generados. No es una medicion util del CRM |
| `npx vitest run` | 1 / ~70 s | Descubrimiento global | Contamino la corrida con `n8n-mcp`; no se acepta como baseline del producto |
| Vitest con 21 candidatos locales explicitos | 1 / 7.431 s | 21 archivos | 33 casos: 32 pasaron, 1 fallo intencional; 8 archivos sin suite y 5 specs Playwright cargados por error |
| `npm run build` | timeout / 898.105 s | Build Next/PWA | Sin exit code; no aprobado. `next.config.mjs` ademas contiene `ignoreBuildErrors: true` |

## Salud y deuda

- Salud actual: el nucleo determinista de sincronizacion pasa 11/11 y su typecheck enfocado pasa.
- Deuda heredada: lint global sin alcance; errores TypeScript/lint del producto se capturan en `quality/baseline.json`; una prueba falla intencionalmente; ocho archivos `pruebas unitarias/*` no contienen suite.
- Fallos no aceptables como aprobados: build sin terminar; ausencia de contrato RLS real; migraciones locales no versionadas; prueba intencionalmente roja.
- NOT_CONFIGURED: replay de base autoritativa con dos usuarios, contrato SAP/ForceManager sandbox y E2E autenticado de Supabase/Microsoft.
- Flakiness conocida: no cuantificada. El build excedio 15 minutos; Playwright aun no se ejecuto dentro del gate nuevo.
- Cobertura: concentrada en sync y unas pocas funciones puras. CRUD, autorizacion real, comisiones, importaciones, Edge Functions e integraciones carecen de pruebas negativas reales.

El baseline monotono solo autoriza identidades heredadas. Una identidad nueva o un aumento en una identidad existente bloquea. `qa:baseline:update` solo puede reducirlo.

Baseline de adopcion exacto: 847 mensajes ESLint agrupados en 239 identidades archivo/regla; 0 errores TypeScript; 9 fallos Vitest por identidad exacta; 25 supresiones/exclusiones agrupadas en 20 identidades de politica.

## Evidencia posterior a la adopcion

El gate autorizado `2026-08-29T01-25-42-469Z-gate` demostro que el build si puede completar: 47.480 s, 45 paginas generadas y exit 0. Next informo `Skipping validation of types`; el control independiente `type-ratchet` verifico 0 errores. Los tres E2E Chromium pasaron en 10.053 s. El gate global quedo `FAILED` por 22 migraciones SQL locales no versionadas; por ello el replay de base no llego a ejecutarse.
