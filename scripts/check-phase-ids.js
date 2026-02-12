const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhaseMatching() {
    const { data: phases } = await supabase
        .from('CRM_FasesOportunidad')
        .select('id, nombre')
        .eq('is_active', true);

    const won = [];
    const lost = [];

    phases.forEach(p => {
        const nombre = p.nombre.toLowerCase();
        if (nombre.includes('ganada')) won.push(p.id);
        else if (nombre.includes('perdida')) lost.push(p.id);
    });

    console.log(JSON.stringify({
        totalPhases: phases.length,
        wonIds: won,
        lostIds: lost,
        closedIds: [...won, ...lost]
    }, null, 2));
}

checkPhaseMatching();
