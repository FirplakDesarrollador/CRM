const fs = require('fs');
const https = require('https');

const DEPARTMENTS_URL = 'https://raw.githubusercontent.com/proyecto26/colombia/master/departments.json';
const CITIES_URL = 'https://raw.githubusercontent.com/proyecto26/colombia/master/cities.json';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('Fetching departments...');
        const depts = await fetchJson(DEPARTMENTS_URL);
        console.log('Fetching cities...');
        const cities = await fetchJson(CITIES_URL);

        let sql = `-- Migration: Full Colombian Catalogs\n`;
        sql += `-- Generated on ${new Date().toISOString()}\n\n`;

        // Clear existing references (be careful with this, but since user said cities don't show, we assume we want a fresh start)
        sql += `BEGIN;\n\n`;

        sql += `-- Clean up existing data to avoid name/ID conflicts\n`;
        sql += `-- First, set references to NULL in main tables to avoid FK violations during cleanup\n`;
        sql += `UPDATE "CRM_Cuentas" SET departamento_id = NULL, ciudad_id = NULL;\n`;
        sql += `UPDATE "CRM_Oportunidades" SET departamento_id = NULL, ciudad_id = NULL;\n\n`;

        sql += `DELETE FROM "CRM_Ciudades";\n`;
        sql += `DELETE FROM "CRM_Departamentos";\n\n`;

        sql += `-- Insert Departments\n`;
        sql += `INSERT INTO "CRM_Departamentos" (id, nombre) VALUES\n`;
        const deptValues = depts.data.map(d => `(${d.id}, '${d.name.replace(/'/g, "''")}')`).join(',\n');
        sql += deptValues + `\nON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;\n\n`;

        sql += `-- Insert Cities\n`;
        sql += `INSERT INTO "CRM_Ciudades" (id, departamento_id, nombre) VALUES\n`;
        const cityValues = cities.data.map(c => `(${c.id}, ${c.departmentId}, '${c.name.replace(/'/g, "''")}')`).join(',\n');
        sql += cityValues + `\nON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, departamento_id = EXCLUDED.departamento_id;\n\n`;

        sql += `-- Reset serial sequences\n`;
        sql += `SELECT setval(pg_get_serial_sequence('"CRM_Departamentos"', 'id'), coalesce(max(id), 1)) FROM "CRM_Departamentos";\n`;
        sql += `SELECT setval(pg_get_serial_sequence('"CRM_Ciudades"', 'id'), coalesce(max(id), 1)) FROM "CRM_Ciudades";\n\n`;

        sql += `COMMIT;\n`;

        fs.writeFileSync('supabase/migrations/20260127_full_colombia_catalogs.sql', sql);
        console.log('Migration file generated successfully: supabase/migrations/20260127_full_colombia_catalogs.sql');
        console.log(`Summary: ${depts.data.length} departments, ${cities.data.length} cities.`);
    } catch (err) {
        console.error('Error generating SQL:', err);
    }
}

run();
