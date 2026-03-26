const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePhases() {
    console.log('Analyzing phases for filter logic...\n');

    // Get all active phases
    const { data: phases, error } = await supabase
        .from('CRM_FasesOportunidad')
        .select('id, nombre')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching phases:', error);
        return;
    }

    console.log(`Total active phases: ${phases.length}\n`);

    // Simulate the filter logic from useOpportunitiesServer
    const won = [];
    const lost = [];

    phases.forEach(p => {
        const nombre = p.nombre.toLowerCase();
        console.log(`Phase ID ${p.id}: "${p.nombre}" -> lowercase: "${nombre}"`);

        if (nombre.includes('ganada')) {
            won.push(p.id);
            console.log(`  ✓ Matched as WON`);
        } else if (nombre.includes('perdida')) {
            lost.push(p.id);
            console.log(`  ✓ Matched as LOST`);
        }
    });

    const closed = [...won, ...lost];

    console.log('\n=== FILTER RESULTS ===');
    console.log(`Won phase IDs: [${won.join(', ')}]`);
    console.log(`Lost phase IDs: [${lost.join(', ')}]`);
    console.log(`Closed phase IDs: [${closed.join(', ')}]`);

    // Now check actual opportunities
    console.log('\n=== CHECKING OPPORTUNITIES ===');
    const { data: opps, error: oppError } = await supabase
        .from('CRM_Oportunidades')
        .select('id, nombre, fase_id, fase_data:CRM_FasesOportunidad(nombre)')
        .eq('is_deleted', false)
        .limit(10);

    if (oppError) {
        console.error('Error fetching opportunities:', oppError);
        return;
    }

    console.log(`\nFound ${opps.length} opportunities (showing first 10):`);
    opps.forEach(opp => {
        const phaseName = opp.fase_data?.nombre || 'Unknown';
        const isWon = won.includes(opp.fase_id);
        const isLost = lost.includes(opp.fase_id);
        const isClosed = closed.includes(opp.fase_id);

        console.log(`\n  "${opp.nombre}"`);
        console.log(`    Phase ID: ${opp.fase_id} (${phaseName})`);
        console.log(`    Is Won: ${isWon}`);
        console.log(`    Is Lost: ${isLost}`);
        console.log(`    Is Closed: ${isClosed}`);
        console.log(`    Is Open: ${!isClosed}`);
    });
}

analyzePhases();
