'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TableInspector() {
    const [tables, setTables] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs(prev => [...prev, msg]);

    useEffect(() => {
        async function inspect() {
            // List of candidate table names to check since we can't query information_schema easily
            // with just anon key (usually).
            const candidates = [
                'CRM_Oportunidades',
                'CRM_Cuentas',
                'CRM_Accounts',
                'CRM_Opportunities',
                'CRM_Clientes',
                'CRM_Contacts',
                'CRM_Contactos',
                'CRM_Actividades',
                'CRM_Activities'
            ];

            log("Starting inspection...");

            for (const table of candidates) {
                // Try to fetch 1 row to see if table exists and get schema from the result keys
                const { data, error } = await supabase.from(table).select('*').limit(1);

                if (error) {
                    // 404 means table not found usually, or 401 permission denied.
                    log(`[${table}] Error: ${error.message} (Code: ${error.code})`);
                } else {
                    if (data && data.length > 0) {
                        const keys = Object.keys(data[0]);
                        log(`[${table}] FOUND! Keys: ${keys.join(', ')}`);
                        setTables(prev => [...prev, { name: table, keys }]);
                    } else {
                        log(`[${table}] EXISTS but empty. Cannot infer schema.`);
                        setTables(prev => [...prev, { name: table, keys: [], empty: true }]);
                    }
                }
            }
        }

        inspect();
    }, []);

    return (
        <div className="p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">Supabase Schema Inspector</h1>
            <div className="bg-gray-100 p-4 rounded text-sm font-mono overflow-auto h-96">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
}
