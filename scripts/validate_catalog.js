const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
    console.log('--- Catalog Validation ---');

    const { count: deptCount, error: deptError } = await supabase
        .from('CRM_Departamentos')
        .select('*', { count: 'exact', head: true });

    if (deptError) {
        console.error('Error counting departments:', deptError.message);
    } else {
        console.log(`Departments in Supabase: ${deptCount}`);
    }

    const { count: cityCount, error: cityError } = await supabase
        .from('CRM_Ciudades')
        .select('*', { count: 'exact', head: true });

    if (cityError) {
        console.error('Error counting cities:', cityError.message);
    } else {
        console.log(`Cities in Supabase: ${cityCount}`);
    }

    // Check account references
    const { count: accountRef, error: accError } = await supabase
        .from('CRM_Cuentas')
        .select('*', { count: 'exact', head: true })
        .not('departamento_id', 'is', null);

    if (accError) {
        console.error('Error counting accounts:', accError.message);
    } else {
        console.log(`Accounts with city/dept linked: ${accountRef}`);
    }
}

validate();
