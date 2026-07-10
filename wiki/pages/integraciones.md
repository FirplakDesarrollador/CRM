# Integraciones Externas

El CRM se integra con cuatro sistemas: Microsoft 365 (Graph), SAP, WordPress y
ForceManager.

## Microsoft 365 (Graph API)

Rutas API en `app/api/microsoft/` con OAuth propio (`/login`, `/callback`):

- **Correo:** `send-email` — usado por `SendQuoteModal` para enviar
  [[cotizaciones-y-pedidos|cotizaciones]] (helper `lib/microsoft.ts`).
- **Calendario:** crear/buscar/listar/editar eventos
  (`calendar/create-event`, `events`, `search-event`, `events/[eventId]`). Las
  [[actividades]] tienen columnas de vínculo con eventos Outlook
  (`20260218_add_activities_ms_columns`).
- **Planner:** grupos, planes, buckets y tareas (`planner/*`,
  `lib/types/planner-types.ts`).
- **Usuarios:** `microsoft/users`.

## SAP

Integración **asíncrona por cola**: `CRM_SapIntegrationQueue`. Los campos logísticos y
comerciales de la cotización/pedido se mapean a nombres `EXTRA_*`
(`SAP_MAPPING` en `lib/sync.ts`): incoterm, flete, seguro, puertos, formas/términos de
pago, tipo de facturación, orden de compra, etc. SAP devuelve el número de orden de venta
(`sales_order_number`) y estado del pedido. Ver [[cotizaciones-y-pedidos]] y
[[sincronizacion-offline]].

## WordPress (lead intake)

Edge Function `wordpress-lead-intake`: recibe leads del formulario web de firplak.com.

- Seguridad: header `x-firplak-secret` validado contra `WP_LEAD_SECRET`.
- Asigna el lead a un asesor según el correo receptor (mapa `ASESORES_POR_CORREO`),
  con propietario fallback del canal Propio.
- Crea la oportunidad en el canal `PROPIO` con estado inicial "Contacto Inicial" (id 8).
  Ver [[canales-de-venta]] y [[oportunidades]].

## ForceManager (CRM legado)

`lib/forcemanager.ts` implementa la autenticación firmada de la API v4 de ForceManager
(firma SHA1 de `timestamp + publicKey + privateKey`, headers `X-FM-*`). Se usa para
importar/consultar datos del CRM anterior. Credenciales en `.env`
(`NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY`, `FORCEMANAGER_PRIVATE_KEY`).

## Fuentes

- `app/api/microsoft/`, `lib/microsoft.ts`
- `lib/sync.ts` (SAP_MAPPING), `supabase/schema.sql` (`CRM_SapIntegrationQueue`)
- `supabase/functions/wordpress-lead-intake/index.ts`
- `lib/forcemanager.ts`
