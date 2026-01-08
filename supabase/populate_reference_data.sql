-- POPULATE REFERENCE DATA FOR CRM FIRPLAK
-- This script populates all catalog/reference tables needed for the CRM to function
-- Run this in your Supabase SQL Editor

-- 1. CURRENCIES
INSERT INTO public."CRM_Currencies" (code, name, symbol, is_base, is_active)
VALUES 
    ('COP', 'Peso Colombiano', '$', TRUE, TRUE),
    ('USD', 'Dólar Estadounidense', 'US$', FALSE, TRUE),
    ('EUR', 'Euro', '€', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. OPPORTUNITY STATES
INSERT INTO public."CRM_EstadosOportunidad" (nombre, is_active)
VALUES 
    ('Abierta', TRUE),
    ('Ganada', TRUE),
    ('Perdida', TRUE),
    ('Cancelada', TRUE)
ON CONFLICT DO NOTHING;

-- 3. OPPORTUNITY PHASES
INSERT INTO public."CRM_FasesOportunidad" (nombre, orden, is_active)
VALUES 
    ('Prospecto', 1, TRUE),
    ('Calificación', 2, TRUE),
    ('Propuesta', 3, TRUE),
    ('Negociación', 4, TRUE),
    ('Cierre', 5, TRUE)
ON CONFLICT DO NOTHING;

-- 4. ACTIVITY TYPES
INSERT INTO public."CRM_TiposActividad" (nombre, is_system)
VALUES 
    ('Llamada', FALSE),
    ('Reunión', FALSE),
    ('Email', FALSE),
    ('Tarea', FALSE),
    ('Seguimiento', FALSE),
    ('Visita', FALSE)
ON CONFLICT DO NOTHING;

-- Verify insertions
SELECT 'Currencies' as tabla, count(*) as registros FROM public."CRM_Currencies"
UNION ALL
SELECT 'Estados', count(*) FROM public."CRM_EstadosOportunidad"
UNION ALL
SELECT 'Fases', count(*) FROM public."CRM_FasesOportunidad"
UNION ALL
SELECT 'Tipos Actividad', count(*) FROM public."CRM_TiposActividad"
UNION ALL
SELECT 'Usuarios', count(*) FROM public."CRM_Usuarios";
