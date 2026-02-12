const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration(filePath, description) {
    console.log(`\n=== Applying: ${description} ===`);
    console.log(`File: ${filePath}`);

    const sql = fs.readFileSync(filePath, 'utf8');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('ERROR:', error);
        return false;
    }

    console.log('SUCCESS');
    return true;
}

async function populatePhases() {
    console.log('Starting phase population process...\n');

    // Step 1: Populate reference data (creates generic phases)
    const populateFile = path.join(__dirname, '..', 'supabase', 'populate_reference_data.sql');
    await applyMigration(populateFile, 'Populate Reference Data (Generic Phases)');

    // Step 2: Apply sales channels migration (duplicates phases for each channel)
    const salesChannelsFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260108_sales_channels.sql');
    await applyMigration(salesChannelsFile, 'Sales Channels Migration');

    // Step 3: Apply channel-specific phase migrations
    const phaseMigrations = [
        '20260109_obras_nac_phases.sql',
        '20260110_obras_int_phases.sql',
        '20260111_dist_nac_phases.sql',
        '20260112_dist_int_phases.sql',
        '20260112_propio_phases.sql'
    ];

    for (const migration of phaseMigrations) {
        const filePath = path.join(__dirname, '..', 'supabase', 'migrations', migration);
        await applyMigration(filePath, migration);
    }

    // Step 4: Add probability column
    const probabilityFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260202_add_probability.sql');
    await applyMigration(probabilityFile, 'Add Probability Column');

    // Verify
    console.log('\n=== VERIFICATION ===');
    const { data: phases, error } = await supabase
        .from('CRM_FasesOportunidad')
        .select('id, nombre, canal_id, is_active')
        .eq('is_active', true);

    if (error) {
        console.error('Error verifying:', error);
    } else {
        console.log(`Total active phases: ${phases.length}`);
        console.log('Phases:', JSON.stringify(phases, null, 2));
    }
}

populatePhases();
