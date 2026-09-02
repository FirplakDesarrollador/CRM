const { createClient } = require('@supabase/supabase-js');

async function main() {
    const url = 'https://lnphhmowklqiomownurw.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';
    const supabase = createClient(url, key);

    // Let's get active phases
    const { data: phases } = await supabase
        .from('CRM_FasesOportunidad')
        .select('id, nombre')
        .eq('is_active', true);

    const won = [];
    const lost = [];
    (phases || []).forEach(p => {
        const nombre = p.nombre.toLowerCase();
        if (nombre.includes('ganada')) won.push(p.id);
        else if (nombre.includes('perdida')) lost.push(p.id);
    });
    const closedPhaseIds = [...won, ...lost];
    console.log("Closed Phase IDs:", closedPhaseIds);

    const accountRelation = 'account:CRM_Cuentas(nombre, canal_id, subclasificacion_id)';

    let query = supabase
        .from('CRM_Oportunidades')
        .select(`
            id,
            nombre,
            account_id,
            fase_id,
            amount,
            currency_id,
            owner_user_id,
            updated_at,
            created_at,
            fecha_cierre_estimada,
            segmento_id,
            created_by,
            origen_oportunidad,
            ${accountRelation},
            fase_data:CRM_FasesOportunidad(nombre),
            estado_data:CRM_EstadosOportunidad(nombre),
            vendedor:CRM_Usuarios!owner_user_id(full_name)
        `, { count: 'exact' })
        .eq('is_deleted', false);

    // statusFilter === 'open'
    if (closedPhaseIds.length > 0) {
        query = query.not('fase_id', 'in', `(${closedPhaseIds.join(',')})`);
    }
    query = query.or('estado_id.is.null,estado_id.not.in.(2,3,4,11,14)');

    query = query.order('updated_at', { ascending: false });
    query = query.range(0, 49);

    const { data, error, count } = await query;
    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Count:", count);
        console.log("Data length:", data?.length);
        console.log("Sample 3:", data?.slice(0, 3));
    }
}

main();
