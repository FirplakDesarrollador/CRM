import { supabase } from '../lib/supabase';

async function checkData() {
    console.log('Checking CRM_Cuentas...');
    const { data: cuentas, error: cuentasError } = await supabase
        .from('CRM_Cuentas')
        .select('id, departamento_id, ciudad_id')
        .not('departamento_id', 'is', null);

    if (cuentasError) {
        console.error('Error fetching cuentas:', cuentasError);
    } else {
        console.log(`Found ${cuentas.length} accounts with departments.`);
        if (cuentas.length > 0) {
            console.log('Sample accounts:', cuentas.slice(0, 5));
        }
    }

    console.log('Checking CRM_Oportunidades...');
    const { data: ops, error: opsError } = await supabase
        .from('CRM_Oportunidades')
        .select('id, departamento_id, ciudad_id')
        .not('departamento_id', 'is', null);

    if (opsError) {
        console.error('Error fetching opportunities:', opsError);
    } else {
        console.log(`Found ${ops.length} opportunities with departments.`);
        if (ops.length > 0) {
            console.log('Sample opportunities:', ops.slice(0, 5));
        }
    }
}

checkData();
