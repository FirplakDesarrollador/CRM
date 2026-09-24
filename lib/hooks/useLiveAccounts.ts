"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LiveAccount {
    id: string;
    nombre: string | null;
    canal_id: string | null;
    subclasificacion_id: number | null;
    owner_user_id: string | null;
    created_at: string | null;
    is_deleted: boolean | null;
}

const SELECT_COLUMNS = "id, nombre, canal_id, subclasificacion_id, owner_user_id, created_at, is_deleted";
const PAGE_SIZE = 1000;

async function fetchAllAccounts(): Promise<LiveAccount[]> {
    const rows: LiveAccount[] = [];
    let from = 0;
    // Supabase caps a single response at PAGE_SIZE rows; page through until a
    // short page tells us we've reached the end.
    while (true) {
        const { data, error } = await supabase
            .from("CRM_Cuentas")
            .select(SELECT_COLUMNS)
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data as LiveAccount[]) || [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }
    return rows;
}

/**
 * Live (non-offline-cached) accounts. Same rationale as useLiveOpportunities:
 * the offline Dexie mirror can be stale even right after a manual sync, so
 * this indicadores report page queries Supabase directly.
 */
export function useLiveAccounts() {
    const [accounts, setAccounts] = useState<LiveAccount[]>([]);

    useEffect(() => {
        let active = true;
        fetchAllAccounts()
            .then(rows => {
                if (active) setAccounts(rows);
            })
            .catch(err => console.error("[useLiveAccounts] fetch failed:", err));
        return () => {
            active = false;
        };
    }, []);

    return { accounts };
}
