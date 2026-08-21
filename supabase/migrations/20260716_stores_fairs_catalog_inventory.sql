-- Tiendas-Ferias, origenes configurables, precio de feria e inventario.
-- El inventario se deriva exclusivamente de movimientos activos.

BEGIN;

-- 1. Precio y canal de feria
ALTER TABLE "CRM_ListaDePrecios"
    ADD COLUMN IF NOT EXISTS precio_feria NUMERIC(18, 2) DEFAULT 0;

COMMENT ON COLUMN "CRM_ListaDePrecios".precio_feria IS
    'Precio de venta para ferias; prevalece sobre el precio normal del canal cuando venta_feria esta activo.';

INSERT INTO "CRM_Canales" (id, nombre, columna_precio)
VALUES ('FERIA', 'Feria', 'precio_feria')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    columna_precio = EXCLUDED.columna_precio;

INSERT INTO "CRM_Subclasificacion" (nombre, canal_id)
VALUES ('Cliente de feria', 'FERIA')
ON CONFLICT (nombre, canal_id) DO NOTHING;

INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id, probability)
SELECT nombre, orden, is_active, 'FERIA', probability
FROM "CRM_FasesOportunidad" source
WHERE source.canal_id = 'PROPIO'
  AND NOT EXISTS (
      SELECT 1 FROM "CRM_FasesOportunidad" target
      WHERE target.canal_id = 'FERIA' AND target.nombre = source.nombre
  );

-- Mantener el cargador masivo compatible con la nueva columna y con S&OP.
CREATE OR REPLACE FUNCTION admin_upsert_price_list(prices JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "CRM_Usuarios"
        WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Solo los administradores pueden actualizar la lista de precios';
    END IF;

    INSERT INTO "CRM_ListaDePrecios" (
        numero_articulo, descripcion, lista_base_cop, lista_base_exportaciones,
        lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva, precio_feria,
        descuentos_volumen, planta, familia
    )
    SELECT
        x.numero_articulo,
        x.descripcion,
        COALESCE(x.lista_base_cop, 0),
        COALESCE(x.lista_base_exportaciones, 0),
        COALESCE(x.lista_base_obras, 0),
        COALESCE(x.distribuidor_pvp_iva, 0),
        COALESCE(x.pvp_sin_iva, 0),
        COALESCE(x.precio_feria, 0),
        COALESCE(x.descuentos_volumen, '{}'::JSONB),
        x.planta,
        x.familia
    FROM JSONB_TO_RECORDSET(prices) AS x(
        numero_articulo TEXT,
        descripcion TEXT,
        lista_base_cop NUMERIC,
        lista_base_exportaciones NUMERIC,
        lista_base_obras NUMERIC,
        distribuidor_pvp_iva NUMERIC,
        pvp_sin_iva NUMERIC,
        precio_feria NUMERIC,
        descuentos_volumen JSONB,
        planta TEXT,
        familia TEXT
    )
    ON CONFLICT (numero_articulo) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        lista_base_cop = EXCLUDED.lista_base_cop,
        lista_base_exportaciones = EXCLUDED.lista_base_exportaciones,
        lista_base_obras = EXCLUDED.lista_base_obras,
        distribuidor_pvp_iva = EXCLUDED.distribuidor_pvp_iva,
        pvp_sin_iva = EXCLUDED.pvp_sin_iva,
        precio_feria = EXCLUDED.precio_feria,
        descuentos_volumen = EXCLUDED.descuentos_volumen,
        planta = EXCLUDED.planta,
        familia = EXCLUDED.familia;
END;
$$;

-- 2. Origenes de oportunidad configurables
CREATE TABLE IF NOT EXISTS "CRM_OrigenesOportunidad" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(80) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID DEFAULT auth.uid(),
    updated_by UUID DEFAULT auth.uid()
);

INSERT INTO "CRM_OrigenesOportunidad" (codigo, nombre, orden)
VALUES ('visita', 'Visita', 10), ('wp', 'WhatsApp', 20)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE "CRM_OrigenesOportunidad" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Origenes visibles para autenticados" ON "CRM_OrigenesOportunidad";
CREATE POLICY "Origenes visibles para autenticados"
ON "CRM_OrigenesOportunidad" FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Origenes administrables por admin" ON "CRM_OrigenesOportunidad";
CREATE POLICY "Origenes administrables por admin"
ON "CRM_OrigenesOportunidad" FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE))
WITH CHECK (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE));

-- 3. Inventario por movimientos
CREATE TABLE IF NOT EXISTS "CRM_InventarioMovimientos" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES "CRM_ListaDePrecios"(id) ON DELETE RESTRICT,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('ENTRADA', 'SALIDA', 'RESERVA')),
    cantidad NUMERIC(14, 2) NOT NULL CHECK (cantidad > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'CANCELADO')),
    referencia_tipo VARCHAR(40),
    referencia_id UUID,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL DEFAULT auth.uid(),
    updated_by UUID NOT NULL DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_producto
ON "CRM_InventarioMovimientos" (producto_id, estado, operacion);

CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_fecha
ON "CRM_InventarioMovimientos" (created_at DESC);

CREATE TABLE IF NOT EXISTS "CRM_InventarioMovimientoAuditoria" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id UUID NOT NULL,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('ACTUALIZACION', 'ELIMINACION')),
    valor_anterior JSONB NOT NULL,
    valor_nuevo JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID DEFAULT auth.uid()
);

CREATE OR REPLACE FUNCTION validar_saldo_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entradas NUMERIC := 0;
    v_salidas NUMERIC := 0;
    v_reservas NUMERIC := 0;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.producto_id IS DISTINCT FROM OLD.producto_id THEN
        RAISE EXCEPTION 'El producto de un movimiento no se puede cambiar; cancele el movimiento y cree uno nuevo';
    END IF;

    -- Serializa movimientos concurrentes del mismo producto para evitar sobre-reservas.
    PERFORM 1 FROM "CRM_ListaDePrecios" WHERE id = NEW.producto_id FOR UPDATE;

    SELECT
        COALESCE(SUM(cantidad) FILTER (WHERE operacion = 'ENTRADA'), 0),
        COALESCE(SUM(cantidad) FILTER (WHERE operacion = 'SALIDA'), 0),
        COALESCE(SUM(cantidad) FILTER (WHERE operacion = 'RESERVA'), 0)
    INTO v_entradas, v_salidas, v_reservas
    FROM "CRM_InventarioMovimientos"
    WHERE producto_id = NEW.producto_id
      AND estado = 'ACTIVO'
      AND id IS DISTINCT FROM NEW.id;

    IF NEW.estado = 'ACTIVO' THEN
        IF NEW.operacion = 'ENTRADA' THEN v_entradas := v_entradas + NEW.cantidad; END IF;
        IF NEW.operacion = 'SALIDA' THEN v_salidas := v_salidas + NEW.cantidad; END IF;
        IF NEW.operacion = 'RESERVA' THEN v_reservas := v_reservas + NEW.cantidad; END IF;
    END IF;

    IF (v_entradas - v_salidas - v_reservas) < 0 THEN
        RAISE EXCEPTION 'Inventario insuficiente. Disponible para salida o reserva: %',
            GREATEST(v_entradas - v_salidas - v_reservas + NEW.cantidad, 0);
    END IF;

    NEW.updated_at := NOW();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_saldo_inventario ON "CRM_InventarioMovimientos";
CREATE TRIGGER trg_validar_saldo_inventario
BEFORE INSERT OR UPDATE ON "CRM_InventarioMovimientos"
FOR EACH ROW EXECUTE FUNCTION validar_saldo_inventario();

CREATE OR REPLACE FUNCTION auditar_movimiento_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO "CRM_InventarioMovimientoAuditoria" (
        movimiento_id, accion, valor_anterior, valor_nuevo, changed_by
    ) VALUES (
        OLD.id,
        CASE WHEN TG_OP = 'DELETE' THEN 'ELIMINACION' ELSE 'ACTUALIZACION' END,
        TO_JSONB(OLD),
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE TO_JSONB(NEW) END,
        auth.uid()
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_movimiento_inventario ON "CRM_InventarioMovimientos";
CREATE TRIGGER trg_auditar_movimiento_inventario
AFTER UPDATE OR DELETE ON "CRM_InventarioMovimientos"
FOR EACH ROW EXECUTE FUNCTION auditar_movimiento_inventario();

CREATE OR REPLACE VIEW "CRM_InventarioDisponible" AS
SELECT
    p.id AS producto_id,
    p.numero_articulo,
    p.descripcion,
    COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'ENTRADA' AND m.estado = 'ACTIVO'), 0) AS entradas,
    COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'SALIDA' AND m.estado = 'ACTIVO'), 0) AS salidas,
    COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'RESERVA' AND m.estado = 'ACTIVO'), 0) AS reservas,
    COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'ENTRADA' AND m.estado = 'ACTIVO'), 0)
      - COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'SALIDA' AND m.estado = 'ACTIVO'), 0) AS existencia_fisica,
    COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'ENTRADA' AND m.estado = 'ACTIVO'), 0)
      - COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'SALIDA' AND m.estado = 'ACTIVO'), 0)
      - COALESCE(SUM(m.cantidad) FILTER (WHERE m.operacion = 'RESERVA' AND m.estado = 'ACTIVO'), 0) AS disponible
FROM "CRM_ListaDePrecios" p
LEFT JOIN "CRM_InventarioMovimientos" m ON m.producto_id = p.id
GROUP BY p.id, p.numero_articulo, p.descripcion;

CREATE OR REPLACE FUNCTION reservar_inventario_feria(p_items JSONB, p_opportunity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Se requiere un usuario autenticado';
    END IF;

    INSERT INTO "CRM_InventarioMovimientos" (
        producto_id, operacion, cantidad, estado, referencia_tipo,
        referencia_id, notas, created_by, updated_by
    )
    SELECT
        item.product_id,
        'RESERVA',
        item.cantidad,
        'ACTIVO',
        'OPORTUNIDAD_FERIA',
        p_opportunity_id,
        'Reserva automatica Tiendas-Ferias: ' || COALESCE(item.nombre, item.product_id::TEXT),
        auth.uid(),
        auth.uid()
    FROM JSONB_TO_RECORDSET(p_items) AS item(product_id UUID, cantidad NUMERIC, nombre TEXT)
    WHERE item.cantidad > 0;
END;
$$;

ALTER TABLE "CRM_InventarioMovimientos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_InventarioMovimientoAuditoria" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventario visible para admin" ON "CRM_InventarioMovimientos";
CREATE POLICY "Inventario visible para admin"
ON "CRM_InventarioMovimientos" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE));

DROP POLICY IF EXISTS "Inventario administrable por admin" ON "CRM_InventarioMovimientos";
CREATE POLICY "Inventario administrable por admin"
ON "CRM_InventarioMovimientos" FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE))
WITH CHECK (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE));

-- Las reservas de vendedores pasan exclusivamente por reservar_inventario_feria,
-- que valida y registra el lote completo de forma atomica.
DROP POLICY IF EXISTS "Usuarios pueden reservar inventario" ON "CRM_InventarioMovimientos";

DROP POLICY IF EXISTS "Auditoria inventario visible para admin" ON "CRM_InventarioMovimientoAuditoria";
CREATE POLICY "Auditoria inventario visible para admin"
ON "CRM_InventarioMovimientoAuditoria" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM "CRM_Usuarios" u WHERE u.id = auth.uid() AND u.role = 'ADMIN' AND u.is_active = TRUE));

GRANT SELECT ON "CRM_InventarioDisponible" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CRM_InventarioMovimientos" TO authenticated;
GRANT SELECT ON "CRM_InventarioMovimientoAuditoria" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CRM_OrigenesOportunidad" TO authenticated;
REVOKE ALL ON FUNCTION admin_upsert_price_list(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reservar_inventario_feria(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_upsert_price_list(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reservar_inventario_feria(JSONB, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
