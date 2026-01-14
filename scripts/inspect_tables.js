
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const url = 'https://lnphhmowklqiomownurw.supabase.co';
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

        console.log(`Connecting to Supabase at: ${url}`);

        const supabase = createClient(url, key);

        const tablesToCheck = [
            'CRM_Oportunidades',
            'CRM_Cuentas',
            'CRM_Accounts',
            'CRM_Opportunities',
            'CRM_Clientes',
            'CRM_Contactos',
            'CRM_Contacts',
            'CRM_Actividades',
            'CRM_Activities'
        ];

        const logFile = path.resolve(process.cwd(), 'introspection.log');
        fs.writeFileSync(logFile, "--- START INTROSPECTION ---\n");

        function log(msg) {
            console.log(msg);
            fs.appendFileSync(logFile, msg + "\n");
        }

        log("\nChecking tables...");

        for (const table of tablesToCheck) {
            // Try to select 1 row
            const { data, error } = await supabase.from(table).select('*').limit(1);

            if (error) {
                if (error.code === '42P01') {
                    log(`[${table}] MISSING (42P01)`);
                } else {
                    log(`[${table}] ERROR: ${error.code} - ${error.message}`);
                }
            } else {
                log(`[${table}] EXISTS!`);
                if (data && data.length > 0) {
                    const keys = Object.keys(data[0]);
                    log(`    Columns: ${keys.join(', ')}`);
                } else {
                    log(`    (Empty table, cannot infer columns via SELECT)`);
                }
            }
        }
        log("\n--- END INTROSPECTION ---");

    } catch (err) {
        const logFile = path.resolve(process.cwd(), 'introspection.log');
        fs.appendFileSync(logFile, "Script Error: " + err + "\n");
        console.error("Script Error:", err);
    }
}

main();
