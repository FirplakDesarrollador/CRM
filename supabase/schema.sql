-- CRM FIRPLAK FULL DATABASE SCHEMA (PascalCase Naming)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DROP EXISTING TABLES (Reverse Dependency Order)
-- We use PascalCase to match the existing tables found in the database.
DROP TABLE IF EXISTS "CRM_CotizacionItems";
DROP TABLE IF EXISTS "CRM_Cotizaciones";
DROP TABLE IF EXISTS "CRM_Actividades";
DROP TABLE IF EXISTS "CRM_TransferenciasOportunidad";
DROP TABLE IF EXISTS "CRM_OportunidadColaboradores";
DROP TABLE IF EXISTS "CRM_Oportunidades";
DROP TABLE IF EXISTS "CRM_Contactos";
DROP TABLE IF EXISTS "CRM_Cuentas";
DROP TABLE IF EXISTS "CRM_Files";
DROP TABLE IF EXISTS "CRM_Parameters";
DROP TABLE IF EXISTS "CRM_SapIntegrationQueue";
DROP TABLE IF EXISTS "CRM_Usuarios";
DROP TABLE IF EXISTS "CRM_Productos";
DROP TABLE IF EXISTS "CRM_TiposActividad";
DROP TABLE IF EXISTS "CRM_FasesOportunidad";
DROP TABLE IF EXISTS "CRM_EstadosOportunidad";
DROP TABLE IF EXISTS "CRM_ExchangeRates";
DROP TABLE IF EXISTS "CRM_Currencies";

-- 2. CREATE CATALOGS AND PARAMETERS

CREATE TABLE "CRM_Currencies" (
    code VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    symbol VARCHAR NOT NULL,
    is_base BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "CRM_ExchangeRates" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_code VARCHAR NOT NULL,
    quote_code VARCHAR NOT NULL,
    rate NUMERIC(18, 6) NOT NULL,
    rate_date DATE NOT NULL,
    source VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "CRM_EstadosOportunidad" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE "CRM_FasesOportunidad" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    orden INT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE "CRM_TiposActividad" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE "CRM_Productos" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR NOT NULL UNIQUE,
    nombre VARCHAR NOT NULL,
    descripcion TEXT,
    precio_base NUMERIC(15,2) DEFAULT 0,
    moneda_id VARCHAR DEFAULT 'COP',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "CRM_Parameters" (
    key VARCHAR PRIMARY KEY,
    value TEXT,
    description TEXT
);

CREATE TABLE "CRM_Files" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    file_name VARCHAR,
    size_bytes BIGINT,
    mime_type VARCHAR,
    uploaded_by UUID, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "CRM_SapIntegrationQueue" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR NOT NULL, 
    entity_id UUID NOT NULL,
    payload JSONB,
    status VARCHAR DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE CORE TABLES

-- Table: CRM_Usuarios
CREATE TABLE "CRM_Usuarios" (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email VARCHAR NOT NULL,
    full_name VARCHAR,
    role VARCHAR DEFAULT 'VENDEDOR', 
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: CRM_Cuentas
CREATE TABLE "CRM_Cuentas" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cuenta_principal UUID, 
    nit_base VARCHAR NOT NULL,
    nit_sufijo INT,
    nit VARCHAR GENERATED ALWAYS AS (
        CASE 
            WHEN nit_sufijo IS NULL THEN nit_base
            ELSE nit_base || '#' || nit_sufijo::TEXT
        END
    ) STORED,
    nombre VARCHAR NOT NULL,
    telefono VARCHAR,
    direccion VARCHAR,
    ciudad VARCHAR,
    email VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID, 
    updated_by UUID, 
    is_deleted BOOLEAN DEFAULT FALSE,
    _sync_metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: CRM_Contactos
CREATE TABLE "CRM_Contactos" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL, 
    nombre VARCHAR NOT NULL,
    cargo VARCHAR,
    email VARCHAR,
    telefono VARCHAR,
    es_principal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    _sync_metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: CRM_Oportunidades
CREATE TABLE "CRM_Oportunidades" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL, 
    owner_user_id UUID NOT NULL, 
    nombre VARCHAR NOT NULL,
    amount NUMERIC(15, 2) DEFAULT 0,
    currency_id VARCHAR NOT NULL DEFAULT 'COP', 
    estado_id INT, 
    fase_id INT, 
    fecha_cierre_estimada DATE,
    probabilidad INT,
    sap_doc_entry INT,
    sap_order_id VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN DEFAULT FALSE,
    _sync_metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: CRM_OportunidadColaboradores
CREATE TABLE "CRM_OportunidadColaboradores" (
    opportunity_id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    role VARCHAR DEFAULT 'EDITOR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (opportunity_id, user_id)
);

-- Table: CRM_TransferenciasOportunidad
CREATE TABLE "CRM_TransferenciasOportunidad" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL,
    previous_owner_id UUID,
    new_owner_id UUID,
    transferred_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

-- Table: CRM_Actividades
CREATE TABLE "CRM_Actividades" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID, 
    user_id UUID NOT NULL, 
    tipo_actividad_id INT, 
    asunto VARCHAR NOT NULL,
    descripcion TEXT,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    ms_planner_id VARCHAR,
    ms_event_id VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_completed BOOLEAN DEFAULT FALSE
);

-- Table: CRM_Cotizaciones
CREATE TABLE "CRM_Cotizaciones" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL,
    numero_cotizacion VARCHAR, 
    total_amount NUMERIC(15,2),
    currency_id VARCHAR,
    status VARCHAR DEFAULT 'DRAFT', 
    sap_doc_entry INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Table: CRM_CotizacionItems
CREATE TABLE "CRM_CotizacionItems" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID NOT NULL,
    producto_id UUID,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(15,2) NOT NULL,
    subtotal NUMERIC(15,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    descripcion_linea TEXT 
);

-- 4. CONSTRAINTS AND FOREIGN KEYS

ALTER TABLE "CRM_Cuentas" ADD CONSTRAINT fk_CrmCuentas_parent FOREIGN KEY (id_cuenta_principal) REFERENCES "CRM_Cuentas"(id);
ALTER TABLE "CRM_Cuentas" ADD CONSTRAINT uq_CrmCuentas_nit UNIQUE (nit);
CREATE UNIQUE INDEX idx_CrmCuentas_nit_base_root ON "CRM_Cuentas"(nit_base) WHERE id_cuenta_principal IS NULL;
CREATE UNIQUE INDEX idx_CrmCuentas_parent_suffix ON "CRM_Cuentas"(id_cuenta_principal, nit_sufijo);

ALTER TABLE "CRM_Contactos" ADD CONSTRAINT fk_CrmContactos_account FOREIGN KEY (account_id) REFERENCES "CRM_Cuentas"(id);

ALTER TABLE "CRM_Oportunidades" ADD CONSTRAINT fk_CrmOpp_account FOREIGN KEY (account_id) REFERENCES "CRM_Cuentas"(id);
ALTER TABLE "CRM_Oportunidades" ADD CONSTRAINT fk_CrmOpp_owner FOREIGN KEY (owner_user_id) REFERENCES "CRM_Usuarios"(id);
ALTER TABLE "CRM_Oportunidades" ADD CONSTRAINT fk_CrmOpp_currency FOREIGN KEY (currency_id) REFERENCES "CRM_Currencies"(code);
ALTER TABLE "CRM_Oportunidades" ADD CONSTRAINT fk_CrmOpp_estado FOREIGN KEY (estado_id) REFERENCES "CRM_EstadosOportunidad"(id);
ALTER TABLE "CRM_Oportunidades" ADD CONSTRAINT fk_CrmOpp_fase FOREIGN KEY (fase_id) REFERENCES "CRM_FasesOportunidad"(id);

ALTER TABLE "CRM_OportunidadColaboradores" ADD CONSTRAINT fk_CrmCollab_opp FOREIGN KEY (opportunity_id) REFERENCES "CRM_Oportunidades"(id);
ALTER TABLE "CRM_OportunidadColaboradores" ADD CONSTRAINT fk_CrmCollab_user FOREIGN KEY (user_id) REFERENCES "CRM_Usuarios"(id);

ALTER TABLE "CRM_Actividades" ADD CONSTRAINT fk_CrmAct_opp FOREIGN KEY (opportunity_id) REFERENCES "CRM_Oportunidades"(id);
ALTER TABLE "CRM_Actividades" ADD CONSTRAINT fk_CrmAct_user FOREIGN KEY (user_id) REFERENCES "CRM_Usuarios"(id);
ALTER TABLE "CRM_Actividades" ADD CONSTRAINT fk_CrmAct_tipo FOREIGN KEY (tipo_actividad_id) REFERENCES "CRM_TiposActividad"(id);

ALTER TABLE "CRM_Cotizaciones" ADD CONSTRAINT fk_CrmQuote_opp FOREIGN KEY (opportunity_id) REFERENCES "CRM_Oportunidades"(id);
ALTER TABLE "CRM_Cotizaciones" ADD CONSTRAINT fk_CrmQuote_curr FOREIGN KEY (currency_id) REFERENCES "CRM_Currencies"(code);

ALTER TABLE "CRM_CotizacionItems" ADD CONSTRAINT fk_CrmItem_quote FOREIGN KEY (cotizacion_id) REFERENCES "CRM_Cotizaciones"(id);
ALTER TABLE "CRM_CotizacionItems" ADD CONSTRAINT fk_CrmItem_prod FOREIGN KEY (producto_id) REFERENCES "CRM_Productos"(id);

-- 5. FUNCTION NIT GENERATOR

CREATE OR REPLACE FUNCTION generate_nit_sufijo() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_cuenta_principal IS NOT NULL THEN
        SELECT COALESCE(MAX(nit_sufijo), 0) + 1 INTO NEW.nit_sufijo
        FROM "CRM_Cuentas"
        WHERE id_cuenta_principal = NEW.id_cuenta_principal;
    ELSE
        NEW.nit_sufijo := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_nit_sufijo ON "CRM_Cuentas";
CREATE TRIGGER trg_generate_nit_sufijo
BEFORE INSERT ON "CRM_Cuentas"
FOR EACH ROW EXECUTE FUNCTION generate_nit_sufijo();

-- 6. RLS POLICIES

ALTER TABLE "CRM_Cuentas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Contactos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Oportunidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Actividades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CRM_Cotizaciones" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissive All" ON "CRM_Cuentas" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permissive All" ON "CRM_Contactos" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permissive All" ON "CRM_Oportunidades" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permissive All" ON "CRM_Actividades" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permissive All" ON "CRM_Cotizaciones" FOR ALL TO authenticated USING (true) WITH CHECK (true);
