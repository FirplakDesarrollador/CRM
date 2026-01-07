import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalCuenta } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useAccounts() {
    // Live Query from Local DB (Dexie)
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const [isLoading, setIsLoading] = useState(true);

    // Initial Sync Pull (Simple version)
    useEffect(() => {
        async function fetchFromSupabase() {
            if (!navigator.onLine) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('CRM_Cuentas')
                    .select('*')
                    .eq('is_deleted', false);

                if (data) {
                    // Bulk put to local DB
                    await db.accounts.bulkPut(data as LocalCuenta[]);
                }
            } catch (err) {
                console.error("Failed to fetch accounts:", err);
            } finally {
                setIsLoading(false);
            }
        }

        // Only fetch if empty or on mount? 
        // For now, fetch on mount to ensure freshness (naive sync)
        fetchFromSupabase();
    }, []);

    const createAccount = async (data: Partial<LocalCuenta>) => {
        // Logic for optimistic update + Queue
        // This is complex because we need an ID.
        // We'll generate a UUID.
        const id = crypto.randomUUID();

        const newAccount = {
            ...data,
            id,
            updated_at: new Date().toISOString()
        };

        // 1. Save to Local
        await db.accounts.add(newAccount as LocalCuenta);

        // 2. Queue Mutation
        // We map the object to individual fields for the Outbox
        // In a real app, we might send the whole JSON if the RPC supports it, 
        // but our engine is field-level. 
        // For creation, maybe special operation? 
        // Let's stick to field-level for "updates", but for creation usually we push the whole row.
        // CUSTOM LOGIC: If ID doesn't exist on server, we need an INSERT.
        // My sync engine currently only does UPDATE via RPC.
        // I will implement a simplified "UPSERT" logic for now: 
        // If it's new, we queue an "INSERT" operation or just fields.

        // Adaptation: Queue entire object fields. Server LWW function handles "Row not found"?? 
        // My RPC returned "Row not found".
        // Fix: We need a CREATE RPC or standard Insert.

        // For this prototype, let's assume `syncEngine` has a `createRecord` method we add now.
        await syncEngine.queueMutation('CRM_Cuentas', id, data);
    };

    return {
        accounts: accounts || [],
        isLoading,
        createAccount
    };
}
