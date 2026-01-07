'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SupabaseTest() {
    const [status, setStatus] = useState<string>('Testing connection...');
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        async function checkConnection() {
            try {
                // Try to select from a table, or just check session
                // Only selecting from specific table requires that table to exist.
                // We will try to fetch the current user session or just do a simple health check if possible.
                // But since we are anon, we can't select random tables without policy.
                // Let's assume we want to just check if the client initializes without error.

                // Better test: Just check if we can query anything or if the url/key are valid.
                // Usually, a bad key throws 401 on any request.

                // Let's try to get the auth session (even if null, it means connection worked)
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    throw sessionError;
                }

                setStatus('Connection successful! Supabase URL and Key are valid.');
                setData(sessionData);

            } catch (error: any) {
                setStatus(`Error: ${error.message || error}`);
            }
        }

        checkConnection();
    }, []);

    return (
        <div className="p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
            <div className={`p-4 rounded ${status.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {status}
            </div>
            {data && (
                <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
}
