
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchemas() {
    const tables = ['CRM_Cuentas', 'CRM_Oportunidades', 'CRM_Cotizaciones', 'CRM_CotizacionItems', 'CRM_Actividades'];

    for (const table of tables) {
        console.log(`\n--- ${table} ---`);
        const { data, error } = await supabase.rpc('get_table_columns', { table_name: table });
        if (error) {
            // Fallback: try selecting one row
            const { data: row, error: rowError } = await supabase.from(table).select('*').limit(1);
            if (rowError) {
                console.error(`Error fetching ${table}:`, rowError.message);
            } else if (row && row.length > 0) {
                console.log('Columns:', Object.keys(row[0]));
            } else {
                console.log('No data to infer columns');
            }
        } else {
            console.log('Columns:', data.map(c => `${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));
        }
    }
}

// Helper RPC might not exist, so let's try a direct query to information_schema
async function checkViaQuery() {
    const tables = ['CRM_Cuentas', 'CRM_Oportunidades', 'CRM_Cotizaciones', 'CRM_CotizacionItems', 'CRM_Actividades'];

    for (const table of tables) {
        console.log(`\n--- ${table} ---`);
        const { data, error } = await supabase.from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', table)
            .eq('table_schema', 'public');

        if (error) {
            console.error(`Error fetching ${table}:`, error.message);
        } else {
            console.log('Columns:', data.map(c => `${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));
        }
    }
}

checkViaQuery();
