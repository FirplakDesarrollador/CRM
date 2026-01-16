
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';
    const supabase = createClient(url, key);

    console.log("Listing some opportunities from CRM_Oportunidades...");
    const { data, error } = await supabase
        .from('CRM_Oportunidades')
        .select('id, nombre')
        .limit(20);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Results:", JSON.stringify(data, null, 2));
    }
}

main();
