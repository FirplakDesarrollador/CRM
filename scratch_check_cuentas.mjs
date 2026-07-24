import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log("Checking CRM_Cuentas columns...");
    
    // First try information schema
    const { data: cols, error: colErr } = await supabase.rpc('get_table_columns', { table_name: 'CRM_Cuentas' });
    if (!colErr) {
        console.log("From RPC get_table_columns:", cols.map(c => c.column_name));
    }
    
    // Check one row
    const { data, error } = await supabase.from('CRM_Cuentas').select('*').limit(1);
    if (data && data.length > 0) {
        console.log("From Data Row:", Object.keys(data[0]));
    } else {
        console.log("No data returned", error);
    }
}
run();
