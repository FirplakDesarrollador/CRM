
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const url = 'https://lnphhmowklqiomownurw.supabase.co';
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';

        console.log(`Connecting to Supabase at: ${url}`);

        const supabase = createClient(url, key);

        const tablesToCheck = [
            'CRM_Cuentas',
            'CRM_Oportunidades',
            'CRM_Cotizaciones',
            'CRM_CotizacionItems',
            'CRM_Actividades'
        ];

        const logFile = path.resolve(process.cwd(), 'introspection_result.txt');
        fs.writeFileSync(logFile, "--- START SYNC INSPECTION ---\n");

        function log(msg) {
            console.log(msg);
            fs.appendFileSync(logFile, msg + "\n");
        }

        log("\nChecking Tables and Required Sync Columns...");

        for (const table of tablesToCheck) {
            // Try to select 1 row
            const { data, error } = await supabase.from(table).select('*').limit(1);

            if (error) {
                if (error.code === '42P01') {
                    log(`[${table}] MISSING`);
                } else {
                    log(`[${table}] ERROR: ${error.code} - ${error.message}`);
                }
            } else {
                log(`[${table}] EXISTS!`);
                if (data && data.length > 0) {
                    const keys = Object.keys(data[0]);
                    const required = ['id', '_sync_metadata', 'updated_at', 'created_by'];
                    const missing = required.filter(k => !keys.includes(k));

                    if (missing.length === 0) {
                        log(`    Columns OK: ${keys.join(', ')}`);
                    } else {
                        log(`    MISSING COLUMNS: ${missing.join(', ')}`);
                        log(`    Available: ${keys.join(', ')}`);
                    }
                } else {
                    log(`    (Empty table, cannot check columns accurately via select *)`);
                    // Try to insert a dummy and rollback? No, simpler: check if rpc for schema exists? No.
                }
            }
        }

        log("\nChecking for process_field_updates RPC...");
        const { error: rpcError } = await supabase.rpc('process_field_updates', {
            p_table_name: 'CRM_Cuentas',
            p_updates: [],
            p_user_id: '00000000-0000-0000-0000-000000000000'
        });

        if (rpcError) {
            log(`[RPC] process_field_updates: ERROR - ${rpcError.code} (${rpcError.message})`);
        } else {
            log(`[RPC] process_field_updates: EXISTS!`);
        }

        log("\n--- END SYNC INSPECTION ---");

    } catch (err) {
        console.error("Script Error:", err);
    }
}

main();
