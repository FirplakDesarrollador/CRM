const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    // Buscar cómo se llama exactamente la tabla de usuarios
    const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_schema')
        .eq('table_schema', 'public')
        .ilike('table_name', '%suar%');

    if (error) {
        console.log("Error con information_schema, intentando directo...", error.message);
        
        // Intentar nombres alternativos
        const names = ['CRM_Usuarios', 'crm_usuarios', 'CRM_usuarios', 'usuarios'];
        for (const name of names) {
            const { data: d, error: e } = await supabase.from(name).select('id, full_name, email').limit(1);
            if (!e) {
                console.log(`✅ Tabla encontrada como: "${name}"`);
                console.log("Dato ejemplo:", d);
            } else {
                console.log(`❌ "${name}": ${e.message.substring(0, 60)}`);
            }
        }
        return;
    }

    console.log("Tablas encontradas:", data);
}

run();
