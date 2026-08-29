# Flujos criticos por riesgo

Ordenados primero por fuga/perdida de datos, autorizacion, corrupcion y despues disponibilidad/contratos/experiencia.

## R1 - Aislamiento de datos y autorizacion Supabase

- Actor/entrada: `ADMIN`, `COORDINADOR`, `VENDEDOR` mediante rutas UI, API y cliente Supabase.
- Resultado: cada identidad solo lee/escribe filas permitidas; `p_user_id` coincide con `auth.uid()`.
- Datos/permisos: todas las tablas `CRM_*`, tokens Microsoft y service-role de Edge Functions.
- Dependencias: Supabase Auth, RLS, policies y RPC.
- Proteccion/cobertura: permisos UI en `lib/permissions.ts`; hardening estatico en `20260821230051_harden_sync_engine.sql`; no existe prueba negativa con dos identidades.
- Riesgo: fuga transversal, suplantacion o escritura no autorizada. Criticidad: maxima.
- Prueba enfocada obligatoria: contrato RLS con vendedor A, vendedor B y coordinador sobre base desechable.
- Brecha: `database-replay` esta `NOT_CONFIGURED`; UI guards no prueban RLS.

## R2 - Persistencia y sincronizacion offline sin perdida

- Actor/entrada: usuario que crea/edita offline; `SyncEngine` procesa outbox.
- Resultado: cada sesion usa una base IndexedDB fisicamente separada; entidad y outbox se confirman en una transaccion; la cola sobrevive recargas, reintenta con la misma identidad y conserva dead letters recuperables.
- Datos/permisos: Dexie outbox y entidades CRM permitidas por RPC.
- Dependencias: IndexedDB, red, Supabase/RLS.
- Proteccion/cobertura: 16 casos verdes en `lib/local-database.test.ts`, `lib/sync-runtime.test.ts`, `lib/sync-engine.test.ts` y `lib/hooks/useFormAutoSave.test.tsx`; migracion de hardening.
- Riesgo: perdida silenciosa, corrupcion LWW o escrituras cruzadas. Criticidad: maxima.
- Prueba enfocada obligatoria: `npm run qa:focused -- lib/local-database.test.ts lib/sync-runtime.test.ts lib/sync-engine.test.ts lib/hooks/useFormAutoSave.test.tsx`.
- Brecha: falta integracion real Dexie-Supabase con dos identidades autenticadas, dos pestanas y red intermitente; la migracion legado conserva la base origen como respaldo y no se prueba aun con volumen de produccion.

## R3 - CRUD de cuentas, contactos y oportunidades con ownership

- Actor/entrada: vendedor/coordinador/admin en `/cuentas`, `/contactos`, `/oportunidades`.
- Resultado: crear, editar, asignar, colaborar y borrar logicamente sin mezclar propietarios ni perder campos.
- Datos/permisos: `CRM_Cuentas`, `CRM_Contactos`, `CRM_Oportunidades`, colaboradores.
- Dependencias: Dexie, sync, Supabase/RLS.
- Proteccion/cobertura: cuatro casos de permisos puros y specs de wizard; contactos contiene un fallo intencional.
- Riesgo: perdida de cartera, edicion ajena, duplicados o datos invisibles. Criticidad: alta.
- Prueba enfocada obligatoria: permisos colaboradores y spec del wizard afectado.
- Brecha: no hay contratos CRUD/RLS reales ni cobertura de borrado/restauracion.

## R4 - Cotizacion, formalizacion y pedido con importes correctos

- Actor/entrada: comercial en detalle de oportunidad/cotizacion y `/pedidos`.
- Resultado: cantidades, descuentos, moneda, total y campos F-V-29/SAP del pedido seleccionado se conservan; escrituras de items son atomicas/idempotentes.
- Datos/permisos: `CRM_Cotizaciones`, `CRM_CotizacionItems`, `CRM_Pedidos`, `CRM_PedidoItems`.
- Dependencias: Dexie, RPC sync, SAP/ForceManager.
- Proteccion/cobertura: tres casos en `pedidoFormalization.test.ts`; memoria extensa en `bugs-knowhow.md`.
- Riesgo: pedido o importe incorrecto, perdida de cantidades y corrupcion parcial. Criticidad: alta.
- Prueba enfocada obligatoria: `npm run qa:focused -- "pruebas unitarias/pedidoFormalization.test.ts"` mas prueba de persistencia de items al modificarla.
- Brecha: sin reconciliacion end-to-end ni contrato SAP sandbox.

## R5 - Calculo, visibilidad y pago de comisiones

- Actor/entrada: admin/coordinador configura reglas; vendedor consulta; ledger marca pagos/ajustes.
- Resultado: regla correcta, menor tasa aplicable, colaboraciones y estado de pago coherentes sin exponer otros vendedores.
- Datos/permisos: categorias, reglas, bonus y ledger de comisiones.
- Dependencias: triggers/RPC Supabase y datos de oportunidades/cotizaciones.
- Proteccion/cobertura: migraciones extensas; archivo `comisiones.test.ts` sin casos.
- Riesgo: pago incorrecto o fuga de remuneracion. Criticidad: alta.
- Prueba enfocada obligatoria: matriz de reglas, idempotencia de trigger y visibilidad por rol.
- Brecha: cobertura actual `UNVERIFIED`; debe priorizarse antes de cambios al modulo.

## R6 - Actividades con Calendar/Planner y autosave

- Actor/entrada: comercial crea/edita actividad y checklist; opcionalmente sincroniza Teams/Calendar/Planner.
- Resultado: la actividad local se guarda una vez; IDs remotos se reutilizan; fallos externos no eliminan la copia local.
- Datos/permisos: actividades, metadata de checklist y tokens Microsoft del usuario.
- Dependencias: Dexie, Supabase, Microsoft Graph.
- Proteccion/cobertura: dos specs de harness UI; rutas API autentican con `getUser()`.
- Riesgo: duplicados remotos, perdida de tareas o uso de token ajeno. Criticidad: alta.
- Prueba enfocada obligatoria: specs de activity wizard/checklist y contratos de auth por ruta.
- Brecha: contrato Microsoft solo valida OIDC; no prueba Graph ni renovacion de token.

## R7 - Importacion masiva y entrada de leads

- Actor/entrada: usuario en `POST /api/bulk-accounts`; WordPress mediante Edge Function firmada.
- Resultado: valida lote/secreto, evita duplicados y crea cuenta/contacto/oportunidad coherentes.
- Datos/permisos: cuentas, contactos, oportunidades; service role en Edge Function.
- Dependencias: Supabase y WordPress.
- Proteccion/cobertura: checks de auth/secreto observados en codigo; sin tests.
- Riesgo: escritura masiva incorrecta, duplicados o bypass del secreto. Criticidad: alta.
- Prueba enfocada obligatoria: payload invalido, secreto incorrecto, duplicado e insercion parcial/rollback.
- Brecha: `UNVERIFIED`; no hay entorno Edge Function desechable.

## R8 - Catalogos, precios, inventario, tiendas y ferias

- Actor/entrada: comercial/admin en catalogo, inventario y tiendas.
- Resultado: precio segun feria/canal, inventario y venta vinculados correctamente.
- Datos/permisos: productos, listas de precio, inventario, ferias y ventas de tienda.
- Dependencias: Supabase, Dexie, cargas CSV/XLSX.
- Proteccion/cobertura: un caso prueba prioridad de precio de feria.
- Riesgo: precio o disponibilidad incorrectos. Criticidad: media-alta.
- Prueba enfocada obligatoria: `tests/salesChannels.test.ts` y contratos de carga/importacion.
- Brecha: sin cobertura de inventario, permisos ni concurrencia.

## R9 - Disponibilidad PWA y recuperacion offline

- Actor/entrada: usuario navega con red degradada o actualiza la PWA.
- Resultado: shell/offline disponibles, datos pendientes no se borran y una nueva version no deja caches incompatibles.
- Datos/permisos: caches Workbox, IndexedDB/outbox y sesion local.
- Dependencias: Next PWA, service worker y navegador.
- Proteccion/cobertura: `e2e/pwa/offline-shell.spec.ts` instala el worker de produccion, valida helpers/politica de cache y recarga `/login` sin red; etapa requerida `pwa-offline-e2e` en el gate.
- Riesgo: aplicacion inutilizable o perdida de pendientes. Criticidad: media-alta.
- Prueba enfocada obligatoria: `npm run qa:focused -- e2e/pwa/offline-shell.spec.ts`; para cambios de datos, agregar editar, actualizar version y resincronizar.
- Brecha: shell publico verificado; faltan modulo autenticado, edicion offline, upgrade del worker y resincronizacion end-to-end.

## R10 - Contratos remotos y automatizaciones

- Actor/entrada: rutas Microsoft, SAP/ForceManager, Power Automate, Power BI y workflows n8n.
- Resultado: cambios de API, OAuth o payload se detectan fuera del gate determinista antes de afectar produccion.
- Datos/permisos: tokens, correo, pedidos SAP, notificaciones y facturas.
- Dependencias: proveedores externos y secretos.
- Proteccion/cobertura: comandos manuales Microsoft/Supabase; ForceManager `NOT_CONFIGURED`; n8n tiene protocolo de schema propio.
- Riesgo: degradacion silenciosa sin commit local. Criticidad: media-alta.
- Prueba enfocada obligatoria: contrato read-only/sandbox por proveedor, manual o programado.
- Brecha: no se autorizaron llamadas reales; no se editaron ni validaron nodos n8n.
