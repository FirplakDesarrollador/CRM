
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';
    const supabase = createClient(url, key);

    console.log("Searching for 'Jetski' in CRM_Oportunidades...");
    const { data: dataEs, error: errorEs } = await supabase
        .from('CRM_Oportunidades')
        .select('*')
        .ilike('nombre', '%Jetski%');

    if (errorEs) console.error("Error ES:", errorEs);
    else console.log("Results ES:", JSON.stringify(dataEs, null, 2));

    console.log("\nSearching for 'Jetski' in CRM_Opportunities...");
    const { data: dataEn, error: errorEn } = await supabase
        .from('CRM_Opportunities')
        .select('*')
        .ilike('nombre', '%Jetski%');

    if (errorEn) console.error("Error EN:", errorEn);
    else console.log("Results EN:", JSON.stringify(dataEn, null, 2));
}

main();
