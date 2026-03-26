-- MIGRATION: ADD SUBCLASSIFICATIONS FOR PROPIO CHANNEL
-- Description: Adds sub-classifications for the 'Canal Propio' (B2C) channel.

BEGIN;

-- Insert sub-classifications for PROPIO channel
INSERT INTO "CRM_Subclasificacion" (nombre, canal_id) VALUES 
    ('Cliente final', 'PROPIO'),
    ('Decoradores', 'PROPIO'),
    ('Arquitecto', 'PROPIO'),
    ('Carpintero', 'PROPIO')
ON CONFLICT (nombre, canal_id) DO NOTHING;

COMMIT;
