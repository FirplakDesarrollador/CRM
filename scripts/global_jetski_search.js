
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';
    const supabase = createClient(url, key);

    const tables = ['CRM_Oportunidades', 'CRM_Opportunities', 'CRM_Actividades', 'CRM_Cuentas'];

    for (const table of tables) {
        console.log(`Searching in ${table}...`);
        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .or(`nombre.ilike.%Jetski%,asunto.ilike.%Jetski%`); // Try search in both possible name columns

            if (!error && data && data.length > 0) {
                console.log(`FOUND in ${table}:`, JSON.stringify(data, null, 2));
            }
        } catch (e) { }
    }
}

main();
