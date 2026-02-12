-- Migration: Commission Engine Schema
-- Date: 2026-02-10
-- Description: Creates tables for Commission Categories, Rules, Bonsues, Payments, and the Ledger.

-- 1. Product Categories for Inference
CREATE TABLE IF NOT EXISTS "CRM_ComisionCategorias" (
    id SERIAL PRIMARY KEY,
    prefijo VARCHAR(10) NOT NULL UNIQUE, -- First 6 chars of SKU
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Variable Commission Rules
CREATE TABLE IF NOT EXISTS "CRM_ComisionReglas" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(200),
    vendedor_id UUID REFERENCES "CRM_Usuarios"(id), -- Specific Seller (Optional)
    cuenta_id UUID REFERENCES "CRM_Cuentas"(id),   -- Specific Account (Optional)
    categoria_id INT REFERENCES "CRM_ComisionCategorias"(id), -- Specific Category (Optional)
    canal_id VARCHAR(20) REFERENCES "CRM_Canales"(id), -- Specific Channel (Optional)
    
    porcentaje_comision NUMERIC(5, 2) NOT NULL,
    
    vigencia_desde DATE DEFAULT CURRENT_DATE,
    vigencia_hasta DATE,
    
    priority INT DEFAULT 0, -- Higher number = Higher priority
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 3. Bonus Rules (New!)
CREATE TABLE IF NOT EXISTS "CRM_ReglasBono" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(200) NOT NULL,
    vendedor_id UUID REFERENCES "CRM_Usuarios"(id), -- Specific Seller (Optional, NULL = Global/All)
    
    periodo VARCHAR(20) NOT NULL CHECK (periodo IN ('MENSUAL', 'TRIMESTRAL', 'ANUAL')),
    
    meta_recaudo NUMERIC(15, 2) NOT NULL, -- Target Collected Amount
    monto_bono NUMERIC(15, 2) NOT NULL,   -- Fixed Bonus Amount
    currency_id VARCHAR(3) DEFAULT 'COP',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Payments Log (New! Source of Truth for Collections)
CREATE TABLE IF NOT EXISTS "CRM_Pagos" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oportunidad_id UUID NOT NULL REFERENCES "CRM_Oportunidades"(id),
    monto NUMERIC(15, 2) NOT NULL,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    
    sap_doc_entry VARCHAR(100), -- Reference to SAP Document
    notas TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 5. Commission Ledger (The Immutable Log)
CREATE TABLE IF NOT EXISTS "CRM_ComisionLedger" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    tipo_evento VARCHAR(20) NOT NULL CHECK (tipo_evento IN ('DEVENGADA', 'PAGADA', 'AJUSTE', 'REVERSO', 'BONO')),
    
    oportunidad_id UUID REFERENCES "CRM_Oportunidades"(id),
    cotizacion_id UUID REFERENCES "CRM_Cotizaciones"(id),
    
    vendedor_id UUID NOT NULL REFERENCES "CRM_Usuarios"(id),
    cuenta_id UUID REFERENCES "CRM_Cuentas"(id),
    canal_id VARCHAR(20) REFERENCES "CRM_Canales"(id),
    
    base_amount NUMERIC(15, 2) NOT NULL, -- The amount on which commission/bonus is calculated
    currency_id VARCHAR(3) DEFAULT 'COP',
    
    porcentaje_comision NUMERIC(5, 2), -- Null for Bonuses or fixed Adjustments
    monto_comision NUMERIC(15, 2) NOT NULL, -- The final commission value (can be negative for reversals)
    
    -- Snapshots for Audit
    regla_id UUID REFERENCES "CRM_ComisionReglas"(id),
    regla_snapshot JSONB,
    
    categoria_id INT REFERENCES "CRM_ComisionCategorias"(id),
    categoria_snapshot JSONB,
    
    entrada_referencia_id UUID REFERENCES "CRM_ComisionLedger"(id), -- For PAGADA/AJUSTE/REVERSO, points to the original DEVENGADA
    
    motivo TEXT, -- For Adjustments/Reversals
    sap_payment_ref VARCHAR(100), -- For PAGADA
    
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, POSTED, PAID (Sync status, not business status)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indices for Performance
CREATE INDEX IF NOT EXISTS idx_comision_ledger_oportunidad ON "CRM_ComisionLedger"(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_comision_ledger_vendedor ON "CRM_ComisionLedger"(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_comision_ledger_created_at ON "CRM_ComisionLedger"(created_at);
CREATE INDEX IF NOT EXISTS idx_pagos_oportunidad ON "CRM_Pagos"(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON "CRM_Pagos"(fecha_pago);

-- RLS Policies (Basic)
ALTER TABLE "CRM_ComisionCategorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_ComisionReglas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_ReglasBono" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Pagos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_ComisionLedger" ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (refine later based on roles)
CREATE POLICY "Allow read access to authenticated users" ON "CRM_ComisionCategorias" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON "CRM_ComisionReglas" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON "CRM_ReglasBono" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON "CRM_Pagos" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON "CRM_ComisionLedger" FOR SELECT TO authenticated USING (true);

-- Allow write access to authenticated users (backend logic usually runs as service_role or user with specific permissions)
-- For MVP/Dev, we allow insert
CREATE POLICY "Allow insert to authenticated users" ON "CRM_Pagos" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert to authenticated users" ON "CRM_ComisionLedger" FOR INSERT TO authenticated WITH CHECK (true);
