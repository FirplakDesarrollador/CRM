import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalCuenta } from "@/lib/db";
import { syncEngine } from "@/lib/sync";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useAccounts() {
    // Live Query from Local DB (Dexie)
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const isLoading = false; // Background sync handles loading

    const createAccount = async (data: Partial<LocalCuenta>) => {
        const id = crypto.randomUUID();
        const { data: { user } } = await supabase.auth.getUser();
        const newAccount = {
            ...data,
            id,
            created_by: user?.id,
            updated_at: new Date().toISOString()
        };
        await db.accounts.add(newAccount as LocalCuenta);
        await syncEngine.queueMutation('CRM_Cuentas', id, data);
    };

    const updateAccount = async (id: string, updates: Partial<LocalCuenta>) => {
        console.log('[useAccounts] DEBUG - updateAccount called with:', { id, updates });
        console.log('[useAccounts] DEBUG - subclasificacion_id in updates:', updates.subclasificacion_id);
        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        await db.accounts.update(id, fullUpdates);
        console.log('[useAccounts] DEBUG - Calling syncEngine.queueMutation with updates:', updates);
        await syncEngine.queueMutation('CRM_Cuentas', id, updates);
        console.log('[useAccounts] DEBUG - queueMutation completed');
    };

    return {
        accounts: accounts || [],
        isLoading,
        createAccount,
        updateAccount
    };
}
