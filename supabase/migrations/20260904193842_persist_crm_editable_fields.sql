-- Restore persistence contracts for editable CRM fields that already exist
-- in the client model and forms. All additions are nullable/idempotent so the
-- migration preserves existing rows and tolerates partially applied schemas.

alter table public."CRM_Contactos"
    add column if not exists comentarios text;

comment on column public."CRM_Contactos".comentarios is
    'Notas internas del contacto capturadas por los formularios del CRM.';

alter table public."CRM_Cotizaciones"
    add column if not exists comentarios text,
    add column if not exists cliente_final text,
    add column if not exists email_contacto text,
    add column if not exists contacto_ventas text,
    add column if not exists contacto_logistico text,
    add column if not exists contacto_tesoreria text,
    add column if not exists dir_envio_factura_tipo text,
    add column if not exists servicio_subida_hidromasaje boolean default false,
    add column if not exists piso_entrega integer,
    add column if not exists tiene_escaleras boolean default false,
    add column if not exists planos_hidromasaje text,
    add column if not exists fecha_entrega date,
    add column if not exists nit_cliente_final text,
    add column if not exists entrega_en_obra boolean default false,
    add column if not exists bodega_externa boolean default false,
    add column if not exists bodega_firplak boolean default false;

comment on column public."CRM_Cotizaciones".comentarios is
    'Comentarios u observaciones de la cotizacion.';
comment on column public."CRM_Cotizaciones".dir_envio_factura_tipo is
    'Tipo de direccion de envio de factura: OFICINA o TIENDA.';

alter table public."CRM_Pedidos"
    add column if not exists email_contacto text,
    add column if not exists tiene_escaleras boolean default false,
    add column if not exists planos_hidromasaje text,
    add column if not exists fecha_entrega date;

comment on column public."CRM_Pedidos".tiene_escaleras is
    'Indica si el medio de acceso para la entrega es escalera.';
