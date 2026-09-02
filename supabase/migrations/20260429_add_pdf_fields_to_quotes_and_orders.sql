-- Agregar los nuevos campos del PDF a CRM_Cotizaciones
ALTER TABLE public."CRM_Cotizaciones"
ADD COLUMN IF NOT EXISTS cliente_final TEXT,
ADD COLUMN IF NOT EXISTS email_contacto TEXT,
ADD COLUMN IF NOT EXISTS contacto_ventas TEXT,
ADD COLUMN IF NOT EXISTS contacto_logistico TEXT,
ADD COLUMN IF NOT EXISTS contacto_tesoreria TEXT,
ADD COLUMN IF NOT EXISTS dir_envio_factura_tipo TEXT,
ADD COLUMN IF NOT EXISTS servicio_subida_hidromasaje BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS piso_entrega INTEGER,
ADD COLUMN IF NOT EXISTS tiene_escaleras BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS planos_hidromasaje TEXT,
ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

-- Agregar los mismos campos a CRM_Pedidos para mantener paridad
ALTER TABLE public."CRM_Pedidos"
ADD COLUMN IF NOT EXISTS cliente_final TEXT,
ADD COLUMN IF NOT EXISTS email_contacto TEXT,
ADD COLUMN IF NOT EXISTS contacto_ventas TEXT,
ADD COLUMN IF NOT EXISTS contacto_logistico TEXT,
ADD COLUMN IF NOT EXISTS contacto_tesoreria TEXT,
ADD COLUMN IF NOT EXISTS dir_envio_factura_tipo TEXT,
ADD COLUMN IF NOT EXISTS servicio_subida_hidromasaje BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS piso_entrega INTEGER,
ADD COLUMN IF NOT EXISTS tiene_escaleras BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS planos_hidromasaje TEXT,
ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

-- Permitir que el SyncEngine detecte estas columnas automáticamente al guardar el JSON
COMMENT ON COLUMN public."CRM_Cotizaciones".cliente_final IS 'Nombre del consumidor final (PDF)';
COMMENT ON COLUMN public."CRM_Cotizaciones".dir_envio_factura_tipo IS 'OFICINA o TIENDA';
