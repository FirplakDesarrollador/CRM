const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking CRM_Cuentas...');
    try {
        const { data: cuentas, error: cuentasError } = await supabase
            .from('CRM_Cuentas')
            .select('id, departamento_id, ciudad_id')
            .not('departamento_id', 'is', null);

        if (cuentasError) {
            console.error('Error fetching cuentas:', cuentasError);
        } else {
            console.log(`Found ${cuentas ? cuentas.length : 0} accounts with departments.`);
            if (cuentas && cuentas.length > 0) {
                console.log('Sample account IDs:', cuentas.slice(0, 5).map(c => c.id));
            }
        }
    } catch (e) {
        console.error('Exception checking cuentas:', e.message);
    }

    console.log('Checking CRM_Oportunidades...');
    try {
        const { data: ops, error: opsError } = await supabase
            .from('CRM_Oportunidades')
            .select('id, departamento_id, ciudad_id')
            .not('departamento_id', 'is', null);

        if (opsError) {
            console.error('Error fetching opportunities:', opsError);
        } else {
            console.log(`Found ${ops ? ops.length : 0} opportunities with departments.`);
            if (ops && ops.length > 0) {
                console.log('Sample op IDs:', ops.slice(0, 5).map(o => o.id));
            }
        }
    } catch (e) {
        console.error('Exception checking ops:', e.message);
    }
}

checkData();
