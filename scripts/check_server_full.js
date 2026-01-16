
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';
    const supabase = createClient(url, key);

    console.log("Listing ALL opportunities from CRM_Oportunidades...");
    const { data, error } = await supabase
        .from('CRM_Oportunidades')
        .select('id, nombre, updated_at')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Total count:", data.length);
        console.log("Results (first 5):", JSON.stringify(data.slice(0, 5), null, 2));
        const jetski = data.find(o => o.nombre.includes('Jetski'));
        if (jetski) {
            console.log("JETSKI FOUND ON SERVER:", jetski);
        } else {
            console.log("Jetski NOT found on server.");
        }
    }
}

main();
