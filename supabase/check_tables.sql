-- List existing CRM tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'CRM_%'
ORDER BY table_name;
