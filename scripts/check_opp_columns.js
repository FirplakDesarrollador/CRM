
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';
    const supabase = createClient(url, key);

    console.log("Listing columns for CRM_Oportunidades...");

    // We can't use raw SQL easily, so we'll try to get one record and see keys, 
    // or use the RPC we just created if we trust it? No, let's try to provoke a known error or something.
    // Actually, I can use the 'rpc' to get columns if I write a temporary rpc? 
    // No, I'll just try to select '*' from one row.

    const { data, error } = await supabase.from('CRM_Oportunidades').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Columns found:", data.length > 0 ? Object.keys(data[0]) : "Table empty, cannot see columns via select *");
    }
}

main();
