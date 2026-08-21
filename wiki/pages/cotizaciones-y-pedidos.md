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
- **Envío formal:** `SendQuoteModal` se abre únicamente desde un pedido guardado y
  completo; envía por correo el PDF construido con los datos e ítems de ese pedido
  (vía Microsoft Graph, ver [[integraciones]]).
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

La descarga del PDF y el envío por correo viven en las acciones de cada pedido dentro
del submódulo **Pedido**. No están disponibles desde el encabezado general de la
cotización. Antes de habilitarlas, `getMissingPedidoFormalizationFields` verifica los
nueve datos obligatorios y que el pedido tenga productos con cantidades válidas. El
documento usa las cantidades parciales, descuentos, total y datos logísticos del pedido
seleccionado.

## Campos Obligatorios para Guardar Pedido (Total o Parcial)

Para guardar un pedido (sea parcial o total) desde el submódulo de cotizaciones en Oportunidades (`PedidosEditor.tsx`), la aplicación exige de forma obligatoria los siguientes 9 campos:

1. **`cierre_facturacion`** (`BOOLEAN`): Indica si aplica cierre de facturación.
2. **`fecha_facturacion`** (`DATE`): Fecha programada de facturación.
3. **`es_muestra`** (`BOOLEAN`): Indica si el pedido corresponde a una muestra comercial.
4. **`servicio_subida_hidromasaje`** (`BOOLEAN`): Indica si requiere servicio de subida de hidromasaje.
5. **`piso_entrega`** (`INTEGER`, default `1`): Piso de entrega solicitado (mínimo 1).
6. **Medio de Acceso (`medio_acceso` / `tiene_escaleras`)**: Opción de selección obligatoria entre `ASCENSOR` o `ESCALERA`. Mapeado internamente a `tiene_escaleras`.
7. **`verificacion_previa_firplak`** (`BOOLEAN`): Indica si se requiere verificación previa por parte del personal Firplak.
8. **`direccion_envio_factura`** (`TEXT`): Dirección física exacta donde se debe enviar la factura.
9. **`dir_envio_factura_tipo`** (`TEXT`): Tipo de dirección de factura (`OFICINA` o `TIENDA`).

Sin diligenciar estos 9 campos, el formulario `PedidosEditor.tsx` bloquea la creación del pedido y muestra una alerta con los campos pendientes.

### Precarga automática de campos (Default Values)

Al crear un nuevo pedido parcial (`!pedidoUuid`), el formulario de creación recupera los datos de la Cuenta y sus Contactos mediante consultas reactivas (`useLiveQuery` de Dexie) y precarga automáticamente los siguientes campos para facilitar el diligenciamiento:

- **`cliente_final`**: Nombre de la Cuenta (`LocalCuenta.nombre`).
- **`nit_cliente_final`**: NIT de la Cuenta (`LocalCuenta.nit`).
- **`direccion_envio_factura`**: Dirección física registrada en la Cuenta (`LocalCuenta.direccion`).
- **`email_contacto`**: Correo del Contacto Principal (`LocalContact.email` con `es_principal = true`) o el correo registrado de la Cuenta (`LocalCuenta.email`).
- **`contacto_ventas`**, **`contacto_logistico`**, **`contacto_tesoreria`**: Se busca un contacto asociado a la Cuenta cuyo cargo o nombre coincida con el rol ("venta", "logistica", "tesoreria" / "finan"). Si no se encuentra un rol específico, se usa por defecto el Contacto Principal.
- **`dir_envio_factura_tipo`**: Inicializado por defecto en `"OFICINA"`.

## Módulo Pedidos (`/pedidos`)

- Lista pedidos con estado (`estado_pedido`) y número de orden de venta
  (`sales_order_number`) provenientes de SAP.
- `PedidoEditorForm` en `PedidosEditor.tsx` gestiona la creación y edición. La creación se estructuró como un Wizard de 3 pasos (Cantidades a Pedir, Datos Logísticos SAP, Datos Adicionales).
- En edición, se eliminan los botones de guardado manual y se implementa guardado automático (auto-save) debounced (1.5 segundos) con indicador visual (`AutoSaveIndicator`) integrado vía `useFormAutoSave`. Los cambios de ítems se calculan de forma diferencial (`updatePedidoItems` en `usePedidos.ts`) y se encolan al [[sincronizacion-offline|outbox]] (ver `bugs-knowhow.md` §5 por el histórico).
- ⚠️ El pull de pedidos mapea `id` del servidor → `uuid_generado` local.

## Notas operativas

- `PedidoEditorForm` protege "Crear Pedido Parcial" con índice de último paso y habilitación diferida del botón final. Esto evita creaciones por doble clic heredado desde "Siguiente" al pasar de Datos SAP a Datos Adicionales.

## Fuentes

- `app/oportunidades/[id]/cotizaciones/`, `app/pedidos/page.tsx`
- `components/quotes/PedidosEditor.tsx`, `SendQuoteModal.tsx`
- `lib/hooks/usePedidos.ts`, `useProducts.ts`, `lib/pdfGenerator.ts`, `lib/db.ts`
- Migraciones: `20260109_add_es_pedido`, `20260113_volume_discounts`, `20260421_alterar_crm_pedidos`, `20260429_add_pdf_fields_to_quotes_and_orders`, `20260729_required_order_fields.sql`
