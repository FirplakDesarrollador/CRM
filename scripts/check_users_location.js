const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== Usuarios y sus ubicaciones ===");
    const { data, error } = await supabase
        .from('CRM_Usuarios')
        .select('id, full_name, email, pais, departamento, paises, departamentos, is_active')
        .order('full_name');

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    console.log(`Total usuarios: ${data?.length}`);
    data?.forEach(u => {
        const tienePaises = (u.paises && u.paises.length > 0) || u.pais;
        const icon = tienePaises ? '✅' : '❌';
        console.log(`\n${icon} ${u.full_name || u.email} (activo: ${u.is_active})`);
        console.log(`   pais (legacy): "${u.pais}"`);
        console.log(`   departamento (legacy): "${u.departamento}"`);
        console.log(`   paises[]: ${JSON.stringify(u.paises)}`);
        console.log(`   departamentos[]: ${JSON.stringify(u.departamentos)}`);
    });

    // Ver ID de Antioquia
    console.log("\n=== ID de Antioquia en CRM_Departamentos ===");
    const { data: depts, error: deptsErr } = await supabase
        .from('CRM_Departamentos')
        .select('id, nombre, pais_id')
        .ilike('nombre', '%antioqu%');
    if (deptsErr) console.error(deptsErr.message);
    else console.log(depts);
}

run();
