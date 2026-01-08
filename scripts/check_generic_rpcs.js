
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';
    const supabase = createClient(url, key);

    const commonRpcs = ['exec_sql', 'query', 'run_sql', 'sql'];

    console.log("Checking for common DDL/SQL RPCs...");
    for (const rpc of commonRpcs) {
        const { error } = await supabase.rpc(rpc, { query: 'SELECT 1' });
        if (!error) {
            console.log(`[RPC] ${rpc}: EXISTS!`);
        } else if (error.code !== 'PGRST202') {
            console.log(`[RPC] ${rpc}: EXISTS (but returned error: ${error.message})`);
        } else {
            console.log(`[RPC] ${rpc}: NOT FOUND`);
        }
    }
}

main();
