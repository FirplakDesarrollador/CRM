-- Script para poblar la tabla CRM_FasesOportunidad con todas las fases necesarias
-- Ejecuta esto en el SQL Editor de Supabase

BEGIN;

-- Insertar fases para OBRAS_INT
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id, probability) VALUES
    ('Contacto inicial', 1, true, 'OBRAS_INT', 5),
    ('Presentación de portafolio', 2, true, 'OBRAS_INT', 20),
    ('Acuerdo de precios', 3, true, 'OBRAS_INT', 30),
    ('Recepción de planos', 4, true, 'OBRAS_INT', 50),
    ('Negociación final', 5, true, 'OBRAS_INT', 80),
    ('Cerrada ganada', 6, true, 'OBRAS_INT', 100),
    ('Cerrada Perdida', 7, true, 'OBRAS_INT', 0);

-- Insertar fases para OBRAS_NAC
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id, probability) VALUES
    ('Visita', 1, true, 'OBRAS_NAC', 5),
    ('Presentación de propuesta', 2, true, 'OBRAS_NAC', 10),
    ('Acuerdo de precios', 3, true, 'OBRAS_NAC', 20),
    ('Especificación / Modelo', 4, true, 'OBRAS_NAC', 50),
    ('Negociación final', 5, true, 'OBRAS_NAC', 80),
    ('Cerrada Ganada', 6, true, 'OBRAS_NAC', 100),
    ('Cerrada Perdida', 7, true, 'OBRAS_NAC', 0);

-- Insertar fases para DIST_INT
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id, probability) VALUES
    ('Visita', 1, true, 'DIST_INT', 5),
    ('Presentación de propuesta', 2, true, 'DIST_INT', 20),
    ('Acuerdo de precios', 3, true, 'DIST_INT', 50),
    ('Envío de proforma', 4, true, 'DIST_INT', 80),
    ('Cerrada ganada', 5, true, 'DIST_INT', 100),
    ('Cerrada Perdida', 6, true, 'DIST_INT', 0);

-- Insertar fases para DIST_NAC
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id, probability) VALUES
    ('Visita', 1, true, 'DIST_NAC', 5),
    ('Presentación de propuesta', 2, true, 'DIST_NAC', 20),
    ('Acuerdo de precios', 3, true, 'DIST_NAC', 50),
    ('Esperando pedido', 4, true, 'DIST_NAC', 80),
    ('Cerrada ganada', 5, true, 'DIST_NAC', 100),
    ('Cerrada Perdida', 6, true, 'DIST_NAC', 0);

-- Insertar fases para PROPIO
INSERT INTO "CRM_FasesOportunidad" (nombre, orden, is_active, canal_id, probability) VALUES
    ('Primer contacto', 1, true, 'PROPIO', 5),
    ('Presentación de propuesta', 2, true, 'PROPIO', 10),
    ('Acuerdo de precios', 3, true, 'PROPIO', 20),
    ('Negociación final', 4, true, 'PROPIO', 50),
    ('Esperando pedido', 5, true, 'PROPIO', 90),
    ('Cerrada ganada', 6, true, 'PROPIO', 100),
    ('Cerrada Perdida', 7, true, 'PROPIO', 0);

COMMIT;

-- Verificar que se insertaron correctamente
SELECT canal_id, COUNT(*) as total_fases
FROM "CRM_FasesOportunidad"
WHERE is_active = true
GROUP BY canal_id
ORDER BY canal_id;
