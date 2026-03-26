
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verify() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

    const supabase = createClient(url, key);

    console.log("--- VERIFYING NEW TABLES ---");

    const tables = ['CRM_Departamentos', 'CRM_Ciudades'];

    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) console.error(`Error checking ${table}:`, error.message);
        else console.log(`Table ${table}: ${count} rows found.`);
    }

    console.log("\n--- COLUMN CHECK ---");
    const testTables = ['CRM_Cuentas', 'CRM_Oportunidades'];
    for (const table of testTables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else if (data && data.length > 0) {
            const cols = Object.keys(data[0]);
            const hasDep = cols.includes('departamento_id');
            const hasCity = cols.includes('ciudad_id');
            console.log(`Table ${table} -> departamento_id: ${hasDep ? "OK" : "MISSING"}, ciudad_id: ${hasCity ? "OK" : "MISSING"}`);
        } else {
            console.log(`Table ${table} is empty, checking columns via RPC/Metadata if possible? (Skipping for now)`);
        }
    }
    console.log("\n--- FINISHED ---");
}

verify();
