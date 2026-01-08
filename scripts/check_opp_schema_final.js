import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log("Inspecting CRM_Oportunidades columns...");
    const { data, error } = await supabase.rpc('inspect_table_columns', { p_table_name: 'CRM_Oportunidades' });

    if (error) {
        // Fallback: use a regular query but limited
        const { data: cols, error: err2 } = await supabase
            .from('CRM_Oportunidades')
            .select('*')
            .limit(1);

        if (err2) {
            console.error("Error fetching data:", err2);
        } else {
            console.log("Column names (based on result keys):", Object.keys(cols[0] || {}));
        }
    } else {
        console.log("Detailed Columns:", data);
    }
}

inspectSchema();
