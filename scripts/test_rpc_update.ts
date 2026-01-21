
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

console.log("SCRIPT STARTED");

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('Testing RPC process_field_updates...');

    // 1. Login (optional, but good to simulate real user) - using a hardcoded valid user for this workspace or anon
    // For now, we rely on the fact that RLS allows updates if logged in.
    // We will prompt for email/password or key, OR simpler: use an existing known ACCOUNT ID and update it.

    // NOTE: In this specific project, anonymous edits might be blocked by RLS.
    // Let's try to sign in or use a service role if available (user didn't provide service role key usually).
    // I will check if I can just use the anon client.

    // Let's first fetch a real account to target.
    const { data: accounts, error: fetchError } = await supabase
        .from('CRM_Cuentas')
        .select('id, nombre, subclasificacion_id')
        .limit(1);

    if (fetchError) {
        console.error('Error fetching accounts:', fetchError);
        return;
    }

    if (accounts.length === 0) {
        console.log('No accounts found to test.');
        return;
    }

    const targetAccount = accounts[0];
    console.log('Target Account:', targetAccount);

    // 2. Prepare Update Payload
    // Simulate what SyncEngine sends: ID, field, value, timestamp
    // We'll toggle the subclasificacion_id

    // We need a valid ID for subclasificacion.
    // Fetch one legitimate subclasificacion id
    const { data: subs } = await supabase.from('CRM_Subclasificacion').select('id, nombre').limit(1);
    if (!subs || subs.length === 0) {
        console.error("No subclassifications found");
        return;
    }
    const validSubId = subs[0].id;

    const newValue = targetAccount.subclasificacion_id === validSubId ? null : validSubId;

    const updates = [
        {
            id: targetAccount.id,
            field: 'subclasificacion_id',
            value: newValue,
            ts: Date.now()
        }
    ];

    console.log('Sending updates:', JSON.stringify(updates, null, 2));

    // 3. Call RPC
    // We need a User ID. Since we aren't logged in via Auth helper in Node, we might need to fake it 
    // OR the RPC requires a valid user ID p_user_id.
    // The RPC definition takes p_user_id as an argument.
    // We can pass a dummy UUID if RLS allows it, or the account creator's ID.

    // Let's try to get the 'created_by' from the account
    const { data: accDetails } = await supabase.from('CRM_Cuentas').select('created_by').eq('id', targetAccount.id).single();
    const userId = accDetails?.created_by || '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase.rpc('process_field_updates', {
        p_table_name: 'CRM_Cuentas',
        p_updates: updates,
        p_user_id: userId
    });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Success:', JSON.stringify(data, null, 2));
    }

    // 4. Verification Check
    const { data: postCheck } = await supabase
        .from('CRM_Cuentas')
        .select('id, subclasificacion_id')
        .eq('id', targetAccount.id)
        .single();

    console.log('Post-Update Value:', postCheck?.subclasificacion_id);

    if (postCheck?.subclasificacion_id === newValue) {
        console.log("TEST PASSED: Value persisted.");
    } else {
        console.error("TEST FAILED: Value did not persist.");
    }

    const result = {
        updates,
        rpcData: data,
        rpcError: error,
        preValue: targetAccount.subclasificacion_id,
        newValue,
        postValue: postCheck?.subclasificacion_id,
        success: postCheck?.subclasificacion_id === newValue
    };

    fs.writeFileSync('rpc_result.json', JSON.stringify(result, null, 2));
    console.log('Result written to rpc_result.json');
}

testRpc().catch(e => {
    fs.writeFileSync('rpc_error.json', JSON.stringify({ error: e.message, stack: e.stack }));
    console.error(e);
});
