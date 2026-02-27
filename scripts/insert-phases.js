const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertPhases() {
    console.log('Inserting phases for all channels...\n');

    const phases = [
        // OBRAS_INT
        { nombre: 'Contacto inicial', orden: 1, is_active: true, canal_id: 'OBRAS_INT', probability: 5 },
        { nombre: 'Presentación de portafolio', orden: 2, is_active: true, canal_id: 'OBRAS_INT', probability: 20 },
        { nombre: 'Acuerdo de precios', orden: 3, is_active: true, canal_id: 'OBRAS_INT', probability: 30 },
        { nombre: 'Recepción de planos', orden: 4, is_active: true, canal_id: 'OBRAS_INT', probability: 50 },
        { nombre: 'Negociación final', orden: 5, is_active: true, canal_id: 'OBRAS_INT', probability: 80 },
        { nombre: 'Cerrada ganada', orden: 6, is_active: true, canal_id: 'OBRAS_INT', probability: 100 },
        { nombre: 'Cerrada Perdida', orden: 7, is_active: true, canal_id: 'OBRAS_INT', probability: 0 },

        // OBRAS_NAC
        { nombre: 'Visita', orden: 1, is_active: true, canal_id: 'OBRAS_NAC', probability: 5 },
        { nombre: 'Presentación de propuesta', orden: 2, is_active: true, canal_id: 'OBRAS_NAC', probability: 10 },
        { nombre: 'Acuerdo de precios', orden: 3, is_active: true, canal_id: 'OBRAS_NAC', probability: 20 },
        { nombre: 'Especificación / Modelo', orden: 4, is_active: true, canal_id: 'OBRAS_NAC', probability: 50 },
        { nombre: 'Negociación final', orden: 5, is_active: true, canal_id: 'OBRAS_NAC', probability: 80 },
        { nombre: 'Cerrada Ganada', orden: 6, is_active: true, canal_id: 'OBRAS_NAC', probability: 100 },
        { nombre: 'Cerrada Perdida', orden: 7, is_active: true, canal_id: 'OBRAS_NAC', probability: 0 },

        // DIST_INT
        { nombre: 'Visita', orden: 1, is_active: true, canal_id: 'DIST_INT', probability: 5 },
        { nombre: 'Presentación de propuesta', orden: 2, is_active: true, canal_id: 'DIST_INT', probability: 20 },
        { nombre: 'Acuerdo de precios', orden: 3, is_active: true, canal_id: 'DIST_INT', probability: 50 },
        { nombre: 'Envío de proforma', orden: 4, is_active: true, canal_id: 'DIST_INT', probability: 80 },
        { nombre: 'Cerrada ganada', orden: 5, is_active: true, canal_id: 'DIST_INT', probability: 100 },
        { nombre: 'Cerrada Perdida', orden: 6, is_active: true, canal_id: 'DIST_INT', probability: 0 },

        // DIST_NAC
        { nombre: 'Visita', orden: 1, is_active: true, canal_id: 'DIST_NAC', probability: 5 },
        { nombre: 'Presentación de propuesta', orden: 2, is_active: true, canal_id: 'DIST_NAC', probability: 20 },
        { nombre: 'Acuerdo de precios', orden: 3, is_active: true, canal_id: 'DIST_NAC', probability: 50 },
        { nombre: 'Esperando pedido', orden: 4, is_active: true, canal_id: 'DIST_NAC', probability: 80 },
        { nombre: 'Cerrada ganada', orden: 5, is_active: true, canal_id: 'DIST_NAC', probability: 100 },
        { nombre: 'Cerrada Perdida', orden: 6, is_active: true, canal_id: 'DIST_NAC', probability: 0 },

        // PROPIO
        { nombre: 'Primer contacto', orden: 1, is_active: true, canal_id: 'PROPIO', probability: 5 },
        { nombre: 'Presentación de propuesta', orden: 2, is_active: true, canal_id: 'PROPIO', probability: 10 },
        { nombre: 'Acuerdo de precios', orden: 3, is_active: true, canal_id: 'PROPIO', probability: 20 },
        { nombre: 'Negociación final', orden: 4, is_active: true, canal_id: 'PROPIO', probability: 50 },
        { nombre: 'Esperando pedido', orden: 5, is_active: true, canal_id: 'PROPIO', probability: 90 },
        { nombre: 'Cerrada ganada', orden: 6, is_active: true, canal_id: 'PROPIO', probability: 100 },
        { nombre: 'Cerrada Perdida', orden: 7, is_active: true, canal_id: 'PROPIO', probability: 0 }
    ];

    console.log(`Attempting to insert ${phases.length} phases...`);

    const { data, error } = await supabase
        .from('CRM_FasesOportunidad')
        .insert(phases)
        .select();

    if (error) {
        console.error('ERROR inserting phases:', error);
        return;
    }

    console.log(`SUCCESS! Inserted ${data.length} phases`);

    // Verify
    const { data: allPhases, error: verifyError } = await supabase
        .from('CRM_FasesOportunidad')
        .select('id, nombre, canal_id, is_active')
        .eq('is_active', true);

    if (verifyError) {
        console.error('Error verifying:', verifyError);
    } else {
        console.log(`\nTotal active phases in database: ${allPhases.length}`);

        // Group by canal
        const byCanal = {};
        allPhases.forEach(p => {
            if (!byCanal[p.canal_id]) byCanal[p.canal_id] = [];
            byCanal[p.canal_id].push(p.nombre);
        });

        console.log('\nPhases by channel:');
        Object.keys(byCanal).forEach(canal => {
            console.log(`  ${canal}: ${byCanal[canal].length} phases`);
            byCanal[canal].forEach(nombre => console.log(`    - ${nombre}`));
        });
    }
}

insertPhases();
