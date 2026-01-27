-- Migration: Colombian Cities and Departments
-- Creates catalogs for Departments and Cities and adds references to Accounts and Opportunities

-- 1. Create Departamentos
CREATE TABLE IF NOT EXISTS "CRM_Departamentos" (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR NOT NULL UNIQUE
);

-- 2. Create Ciudades
CREATE TABLE IF NOT EXISTS "CRM_Ciudades" (
    id SERIAL PRIMARY KEY,
    departamento_id INT NOT NULL REFERENCES "CRM_Departamentos"(id),
    nombre VARCHAR NOT NULL,
    UNIQUE(departamento_id, nombre)
);

-- 3. Update Existing Tables
ALTER TABLE "CRM_Cuentas" ADD COLUMN IF NOT EXISTS "departamento_id" INT REFERENCES "CRM_Departamentos"(id);
ALTER TABLE "CRM_Cuentas" ADD COLUMN IF NOT EXISTS "ciudad_id" INT REFERENCES "CRM_Ciudades"(id);

ALTER TABLE "CRM_Oportunidades" ADD COLUMN IF NOT EXISTS "departamento_id" INT REFERENCES "CRM_Departamentos"(id);
ALTER TABLE "CRM_Oportunidades" ADD COLUMN IF NOT EXISTS "ciudad_id" INT REFERENCES "CRM_Ciudades"(id);

-- 4. Populate Departments (Sample)
INSERT INTO "CRM_Departamentos" (nombre) VALUES
('Amazonas'), ('Antioquia'), ('Arauca'), ('Atlántico'), ('Bolívar'), ('Boyacá'), 
('Caldas'), ('Caquetá'), ('Casanare'), ('Cauca'), ('Cesar'), ('Chocó'), 
('Córdoba'), ('Cundinamarca'), ('Guainía'), ('Guaviare'), ('Huila'), ('La Guajira'), 
('Magdalena'), ('Meta'), ('Nariño'), ('Norte de Santander'), ('Putumayo'), ('Quindío'), 
('Risaralda'), ('San Andrés y Providencia'), ('Santander'), ('Sucre'), ('Tolima'), 
('Valle del Cauca'), ('Vaupés'), ('Vichada'), ('Bogotá D.C.')
ON CONFLICT (nombre) DO NOTHING;

-- 5. Populate Main Cities (Sample - A full list will be imported)
-- Reference ID 2 is Antioquia, 33 is Bogotá, etc.
-- I will provide a more complete population script separately if needed, 
-- but here are some examples:

DO $$
DECLARE
    antioquia_id INT;
    bogota_id INT;
    valle_id INT;
BEGIN
    SELECT id INTO antioquia_id FROM "CRM_Departamentos" WHERE nombre = 'Antioquia';
    SELECT id INTO bogota_id FROM "CRM_Departamentos" WHERE nombre = 'Bogotá D.C.';
    SELECT id INTO valle_id FROM "CRM_Departamentos" WHERE nombre = 'Valle del Cauca';

    IF antioquia_id IS NOT NULL THEN
        INSERT INTO "CRM_Ciudades" (departamento_id, nombre) VALUES 
        (antioquia_id, 'Medellín'), (antioquia_id, 'Envigado'), (antioquia_id, 'Itagüí'), (antioquia_id, 'Bello'), (antioquia_id, 'Rionegro')
        ON CONFLICT DO NOTHING;
    END IF;

    IF bogota_id IS NOT NULL THEN
        INSERT INTO "CRM_Ciudades" (departamento_id, nombre) VALUES 
        (bogota_id, 'Bogotá')
        ON CONFLICT DO NOTHING;
    END IF;

    IF valle_id IS NOT NULL THEN
        INSERT INTO "CRM_Ciudades" (departamento_id, nombre) VALUES 
        (valle_id, 'Cali'), (valle_id, 'Palmira'), (valle_id, 'Tuluá'), (valle_id, 'Buenaventura')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
