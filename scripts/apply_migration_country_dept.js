const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan variables de entorno para Supabase");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Intentando aplicar columnas 'pais' y 'departamento' a CRM_Usuarios...");
    const sql = `
        ALTER TABLE "CRM_Usuarios" 
          ADD COLUMN IF NOT EXISTS "pais" TEXT DEFAULT '1',
          ADD COLUMN IF NOT EXISTS "departamento" TEXT;
        NOTIFY pgrst, 'reload schema';
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error("Respuesta RPC exec_sql:", error.message);
    } else {
        console.log("Migración ejecutada con éxito mediante exec_sql.");
    }
}

run();
