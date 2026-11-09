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
- Asigna el lead al usuario activo de `CRM_Usuarios` cuyo correo coincide con el asesor que reporta WordPress (`ownerResolution.ts`; alias `comercialcali@firplak.com` → Hernando Tovar; única reasignación `comercial2@` → Stiven Rua),
  con propietario fallback del canal Propio.
- **Deduplicación Inteligente de Leads:** Si la cuenta ya cuenta con una oportunidad activa/abierta (estados `Abierta` o `Contacto Inicial`) creada en las últimas 24 horas, la Edge Function no genera una oportunidad repetida; en su lugar, anexa los nuevos datos de navegación, origen o formulario en el campo `comentarios` de la oportunidad abierta y actualiza `updated_at`.
- Si no existe oportunidad abierta reciente, crea la oportunidad en el canal `PROPIO` con estado inicial "Contacto Inicial" (id 8).
  Ver [[canales-de-venta]] y [[oportunidades]].

## ForceManager (CRM legado)

`lib/forcemanager.ts` implementa la autenticación firmada de la API v4 de ForceManager
(firma SHA1 de `timestamp + publicKey + privateKey`, headers `X-FM-*`). Se usa para
importar/consultar datos del CRM anterior. Credenciales en `.env`
(`NEXT_PUBLIC_FORCEMANAGER_PUBLIC_KEY`, `FORCEMANAGER_PRIVATE_KEY`).

## API de Exportación BI (Looker Studio / Dimarka)

Edge Function `crm-export-api` (`supabase/functions/crm-export-api/`): API de **solo lectura** para exportar Contactos y Oportunidades del CRM hacia plataformas de analítica y tableros en Looker Studio.

- **Endpoints:**
  - `GET /crm-export-api/contactos`: Contactos enriquecidos con nombre y NIT de la cuenta.
  - `GET /crm-export-api/oportunidades`: Oportunidades enriquecidas con cuenta, asesor, fase, estado, segmento, ciudad, departamento y razón de pérdida.
- **Autenticación:**
  - `Authorization: Bearer <clave>` o header `x-api-key: <clave>` o `apikey: <clave>`.
  - Valida claves autorizadas por hash SHA-256 (incluye claves dedicadas y publishable key de Supabase).
- **Parámetros:** `limit`, `offset`, `updated_since`, `created_since`, `include_deleted`, `order` (`created_at`/`updated_at`), `format` (`json`/`csv`).
- **Control de tráfico:** Límite de 60 peticiones/minuto por combinación de clave e IP.

## Fuentes

- `app/api/microsoft/`, `lib/microsoft.ts`
- `lib/sync.ts` (SAP_MAPPING), `supabase/schema.sql` (`CRM_SapIntegrationQueue`)
- `supabase/functions/wordpress-lead-intake/`
- `supabase/functions/crm-export-api/`
- `supabase/functions/wordpress-lead-intake/index.ts`
- `lib/forcemanager.ts`
