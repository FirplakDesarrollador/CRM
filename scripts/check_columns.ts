
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkColumns() {
    console.log("Checking CRM_Cuentas columns...");

    // We can't easily list columns with anon key unless we have an RPC or use a trick
    // Trick: Fetch one row and see the keys
    const { data, error } = await supabase.from('CRM_Cuentas').select('*').limit(1);

    if (error) {
        console.error("Error fetching row:", error);
    } else if (data && data.length > 0) {
        console.log("Columns found in first row:", Object.keys(data[0]));
    } else {
        console.log("No data in CRM_Cuentas, trying a dummy query to see schema if possible");
        // Alternative: try to select just the new columns
        const { error: colError } = await supabase.from('CRM_Cuentas').select('subclasificacion_id, nivel_premium').limit(0);
        if (colError) {
            console.error("Column check failed (might not exist):", colError.message);
        } else {
            console.log("Columns subclasificacion_id and nivel_premium EXIST.");
        }
    }
}

checkColumns();
