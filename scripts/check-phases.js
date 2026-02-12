const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhases() {
    console.log('Checking CRM_FasesOportunidad table...');

    // Check all phases
    const { data: allPhases, error: allError } = await supabase
        .from('CRM_FasesOportunidad')
        .select('*');

    console.log('\n=== ALL PHASES ===');
    console.log('Error:', allError);
    console.log('Count:', allPhases?.length);
    console.log('Data:', JSON.stringify(allPhases, null, 2));

    // Check active phases
    const { data: activePhases, error: activeError } = await supabase
        .from('CRM_FasesOportunidad')
        .select('id, nombre, is_active')
        .eq('is_active', true);

    console.log('\n=== ACTIVE PHASES ===');
    console.log('Error:', activeError);
    console.log('Count:', activePhases?.length);
    console.log('Data:', JSON.stringify(activePhases, null, 2));
}

checkPhases();
