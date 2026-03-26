-- =============================================================================
-- COMMISSION ENGINE: Immutable Ledger
-- Append-only table with triggers preventing UPDATE and DELETE
-- Date: 2026-02-10
-- Depends on: 20260210_commission_categories.sql, 20260210_commission_rules.sql
-- =============================================================================

-- 1. Commission Ledger (Append-Only)
CREATE TABLE IF NOT EXISTS "CRM_ComisionLedger" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento VARCHAR(20) NOT NULL CHECK (tipo_evento IN ('DEVENGADA', 'PAGADA', 'AJUSTE', 'REVERSO')),

    -- Core references
    oportunidad_id UUID NOT NULL REFERENCES "CRM_Oportunidades"(id),
    cotizacion_id UUID REFERENCES "CRM_Cotizaciones"(id),
    vendedor_id UUID NOT NULL,
    cuenta_id UUID NOT NULL REFERENCES "CRM_Cuentas"(id),
    canal_id VARCHAR(20) NOT NULL REFERENCES "CRM_Canales"(id),

    -- Financial data
    base_amount NUMERIC(15,2) NOT NULL,
    currency_id VARCHAR(10) NOT NULL DEFAULT 'COP',
    porcentaje_comision NUMERIC(5,2) NOT NULL,
    monto_comision NUMERIC(15,2) NOT NULL,

    -- Rule traceability (immutable snapshot)
    regla_id UUID,
    regla_snapshot JSONB NOT NULL,

    -- Category resolution
    categoria_id INT REFERENCES "CRM_ComisionCategorias"(id),
    categoria_snapshot JSONB,

    -- Reversal/Adjustment links
    entrada_referencia_id UUID REFERENCES "CRM_ComisionLedger"(id),
    motivo TEXT,

    -- SAP reference (for PAGADA entries)
    sap_payment_ref VARCHAR(100),

    -- Metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ledger_vendedor ON "CRM_ComisionLedger" (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_ledger_oportunidad ON "CRM_ComisionLedger" (oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_ledger_cuenta ON "CRM_ComisionLedger" (cuenta_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tipo ON "CRM_ComisionLedger" (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON "CRM_ComisionLedger" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_canal ON "CRM_ComisionLedger" (canal_id);
CREATE INDEX IF NOT EXISTS idx_ledger_vendedor_tipo ON "CRM_ComisionLedger" (vendedor_id, tipo_evento);
CREATE INDEX IF NOT EXISTS idx_ledger_referencia ON "CRM_ComisionLedger" (entrada_referencia_id);

-- 2. IMMUTABILITY: Prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRM_ComisionLedger is immutable. Cannot % existing entries.', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_update ON "CRM_ComisionLedger";
CREATE TRIGGER trg_prevent_ledger_update
BEFORE UPDATE ON "CRM_ComisionLedger"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_prevent_ledger_delete ON "CRM_ComisionLedger";
CREATE TRIGGER trg_prevent_ledger_delete
BEFORE DELETE ON "CRM_ComisionLedger"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- 3. RLS Policies (using helper functions from categories migration)
ALTER TABLE "CRM_ComisionLedger" ENABLE ROW LEVEL SECURITY;

-- Vendedores see only their own; Coordinador/Admin see all
CREATE POLICY "Read own or all commissions"
    ON "CRM_ComisionLedger" FOR SELECT TO authenticated
    USING (
        vendedor_id = auth.uid()
        OR is_crm_admin_or_coord()
    );

-- Only Coordinador/Admin can insert (via SECURITY DEFINER RPCs)
CREATE POLICY "Admin/Coord insert ledger"
    ON "CRM_ComisionLedger" FOR INSERT TO authenticated
    WITH CHECK (is_crm_admin_or_coord());

-- service_role bypasses RLS, needed for triggers
CREATE POLICY "Service role full access"
    ON "CRM_ComisionLedger" FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- 4. Grants
GRANT SELECT ON "CRM_ComisionLedger" TO authenticated;
GRANT ALL ON "CRM_ComisionLedger" TO service_role;
