"use client";

import { useEffect, useState } from "react";
import { fetchAllRowsCached, getCachedRows } from "./liveDataCache";

export interface LiveAccount {
    id: string;
    nombre: string | null;
    canal_id: string | null;
    subclasificacion_id: number | null;
    owner_user_id: string | null;
    created_at: string | null;
    is_deleted: boolean | null;
}

const TABLE = "CRM_Cuentas";
const SELECT_COLUMNS = "id, nombre, canal_id, subclasificacion_id, owner_user_id, created_at, is_deleted";

/**
 * Live (non-offline-cached) accounts. Same rationale as useLiveOpportunities:
 * the offline Dexie mirror can be stale even right after a manual sync, so
 * this indicadores report page queries Supabase directly. Fetched in
 * parallel pages and cached for a few minutes (see liveDataCache.ts) so
 * switching between indicadores tabs doesn't re-download the whole table
 * every time.
 */
export function useLiveAccounts() {
    const [accounts, setAccounts] = useState<LiveAccount[]>(
        () => getCachedRows<LiveAccount>(TABLE) || []
    );

    useEffect(() => {
        let active = true;
        fetchAllRowsCached<LiveAccount>(TABLE, SELECT_COLUMNS)
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
