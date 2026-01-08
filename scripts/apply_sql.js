const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySql() {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'rpc_lww.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Applying RPC update to Supabase...");

    // We use a custom RPC to execute SQL or just run it as a string if we have a helper
    // Since we don't have a direct 'sql' method in JS client, 
    // we might need to use a pre-existing RPC or just wait for the user.
    // However, I can try to use 'supabase.rpc' if there's an 'exec_sql' helper.

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        if (error.message.includes("function \"exec_sql\" does not exist")) {
            console.error("Exec SQL helper not found. Please apply the SQL manually in the Supabase Dashboard.");
            console.log("\nSQL CONTENT:\n", sql);
        } else {
            console.error("Error applying SQL:", error.message);
        }
    } else {
        console.log("RPC updated successfully!");
    }
}

applySql();
