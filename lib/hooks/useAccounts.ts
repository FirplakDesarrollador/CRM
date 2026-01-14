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
        const newAccount = {
            ...data,
            id,
            updated_at: new Date().toISOString()
        };
        await db.accounts.add(newAccount as LocalCuenta);
        await syncEngine.queueMutation('CRM_Cuentas', id, data);
    };

    const updateAccount = async (id: string, updates: Partial<LocalCuenta>) => {
        const fullUpdates = { ...updates, updated_at: new Date().toISOString() };
        await db.accounts.update(id, fullUpdates);
        await syncEngine.queueMutation('CRM_Cuentas', id, updates);
    };

    return {
        accounts: accounts || [],
        isLoading,
        createAccount,
        updateAccount
    };
}
