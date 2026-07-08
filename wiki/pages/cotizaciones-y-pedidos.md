# Cotizaciones y Pedidos

Las cotizaciones (`CRM_Cotizaciones` + `CRM_CotizacionItems`) viven dentro de una
[[oportunidades|oportunidad]] (`/oportunidades/[id]/cotizaciones/[quoteId]`). Un **pedido**
es una cotización con `es_pedido = true` (migración `20260109_add_es_pedido`); el módulo
`/pedidos` lista y gestiona la vista logística (`CRM_Pedidos` / `CRM_PedidoItems`).

## Ciclo de la cotización

- **Estados:** `DRAFT → SENT → APPROVED / REJECTED → WINNER`.
- **Ganadora:** `is_winner` marca la cotización que gana la oportunidad; dispara el
  trigger de [[comisiones]] (`20260210_commission_trigger_quotes` + hotfix `is_winner`).
- **Aprobación:** permiso `approve_quote` (COORDINADOR/ADMIN).
- **Envío:** `SendQuoteModal` envía la cotización por correo (vía Microsoft Graph,
  ver [[integraciones]]).
- **Segmentos:** cotizaciones/pedidos se etiquetan con `segmento_id`
  (`20260121_quote_segments`).

## Precios y descuentos

- El precio unitario sale de `CRM_ListaDePrecios` según la columna del
  [[canales-de-venta|canal]] de la cuenta.
- **Descuentos por volumen:** `20260113_volume_discounts` + `20260114_populate_discounts`
  definen límites; las cuentas con `ignorar_limites_descuento` los omiten.
- Descuentos por ítem en `20260114_quote_items_discounts`.
- Carga masiva de precios: `PriceListUploader` + RPC `20260116_add_price_upload_rpc`.
- Monedas y tasas: `CRM_Currencies` / `CRM_ExchangeRates`; precios de exportación
  actualizados vía `20260115_update_export_prices`.

## Datos SAP y logísticos

La cotización/pedido guarda campos que se mapean a SAP con prefijo `EXTRA_`
(`SAP_MAPPING` en `lib/sync.ts`): tipo de facturación, incoterm, puertos, flete, seguro,
formas/términos de pago, orden de compra, ¿es muestra?, ¿aplica contrato?, multa por
incumplimiento, etc. La integración se encola en `CRM_SapIntegrationQueue`
(ver [[integraciones]]).

## Generación de PDF (formato F-V-29)

`lib/pdfGenerator.ts` (jspdf + autotable) genera el PDF de cotización. La migración
`20260429_add_pdf_fields_to_quotes_and_orders` añadió campos del formato F-V-29:
cliente final y su NIT, contactos (ventas/logístico/tesorería), condiciones de entrega
(piso, escaleras, servicio de subida de hidromasaje, entrega en obra, bodega externa/Firplak),
planos de hidromasaje, fecha de entrega.

## Módulo Pedidos (`/pedidos`)

- Lista pedidos con estado (`estado_pedido`) y número de orden de venta
  (`sales_order_number`) provenientes de SAP.
- `PedidosEditor` edita datos logísticos y cantidades de ítems; los cambios de ítems se
  calculan de forma diferencial (`updatePedidoItems` en `usePedidos.ts`) y se encolan al
  [[sincronizacion-offline|outbox]] (ver `bugs-knowhow.md` §5 por el histórico).
- ⚠️ El pull de pedidos mapea `id` del servidor → `uuid_generado` local.

## Fuentes

- `app/oportunidades/[id]/cotizaciones/`, `app/pedidos/page.tsx`
- `components/quotes/PedidosEditor.tsx`, `SendQuoteModal.tsx`
- `lib/hooks/usePedidos.ts`, `useProducts.ts`, `lib/pdfGenerator.ts`
- Migraciones: `20260109_add_es_pedido`, `20260113_volume_discounts`, `20260421_alterar_crm_pedidos`, `20260429_add_pdf_fields_to_quotes_and_orders`
