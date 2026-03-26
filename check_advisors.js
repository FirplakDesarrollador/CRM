require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    let out = {};
    // Query without restricting by ilike full_name just select everything to find it
    const { data: users, error: uErr } = await supabase.from('CRM_Usuarios').select('*').limit(100);
    if (users) {
        out.target = users.filter(u => JSON.stringify(u).toLowerCase().includes('reinaldo'));
        out.all = users;
    }
    fs.writeFileSync('output4.json', JSON.stringify(out, null, 2), 'utf8');
}
main();
