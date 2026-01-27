
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhases() {
    console.log('Fetching CRM_FasesOportunidad from Supabase...');
    const { data: phases, error } = await supabase
        .from('CRM_FasesOportunidad')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching phases:', error);
        fs.writeFileSync('phases_error.txt', JSON.stringify(error, null, 2));
        return;
    }

    console.log(`Found ${phases.length} phases.`);
    fs.writeFileSync('phases.json', JSON.stringify(phases, null, 2));
}

checkPhases().catch(e => {
    console.error(e);
    fs.writeFileSync('phases_crash.txt', e.message);
});
