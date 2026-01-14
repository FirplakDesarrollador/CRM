-- Delete existing OBRAS_NAC phases (cascade handles clean up or re-link manually if needed, 
-- but since we are dev, we can flush and re-insert for this channel)
DELETE FROM "CRM_FasesOportunidad" WHERE "canal_id" = 'OBRAS_NAC';

-- Insert new phases for Obras Nacional
INSERT INTO "CRM_FasesOportunidad" ("nombre", "orden", "is_active", "canal_id") VALUES
('Visita', 1, true, 'OBRAS_NAC'),
('Presentación de propuesta', 2, true, 'OBRAS_NAC'),
('Acuerdo de precios', 3, true, 'OBRAS_NAC'),
('Especificación / Modelo', 4, true, 'OBRAS_NAC'),
('Negociación final', 5, true, 'OBRAS_NAC'),
('Cerrada Ganada', 6, true, 'OBRAS_NAC'),  -- Final State A
('Cerrada Perdida', 7, true, 'OBRAS_NAC'); -- Final State B (Display logic will handle bifurcation)
