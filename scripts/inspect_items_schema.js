
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';
    const supabase = createClient(url, key);

    console.log("Inspecting CRM_CotizacionItems columns...");

    // We'll use the RPC we just optimized to get the column list if possible, or just a select limit 1.
    // Actually, I want to see if is_deleted exists.
    const { data, error } = await supabase.from('CRM_CotizacionItems').select('*').limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Columns found:", data.length > 0 ? Object.keys(data[0]) : "Table empty, checking via RPC...");
        // If table is empty, we can try to find an RPC that returns the columns or use a dummy insert.
    }
}

main();
