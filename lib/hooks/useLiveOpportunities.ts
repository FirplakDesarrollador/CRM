"use client";

import { useEffect, useState } from "react";
import { fetchAllRowsCached, getCachedRows, onLiveDataRefresh } from "./liveDataCache";

export interface LiveOpportunity {
    id: string;
    nombre: string | null;
    account_id: string | null;
    owner_user_id: string | null;
    estado_id: number | null;
    fase_id: number | null;
    segmento_id: number | null;
    amount: number | null;
    fecha_cierre_estimada: string | null;
    created_at: string | null;
    is_deleted: boolean | null;
}

const TABLE = "CRM_Oportunidades";
const SELECT_COLUMNS = "id, nombre, account_id, owner_user_id, estado_id, fase_id, segmento_id, amount, fecha_cierre_estimada, created_at, is_deleted";

/**
 * Live (non-offline-cached) opportunities. Some indicadores report pages
 * compare their totals against a source BI report and found the local Dexie
 * mirror can be stale/incomplete even right after a manual sync — so those
 * pages query Supabase directly instead of going through the offline-first
 * cache used elsewhere in the app. Fetched in parallel pages and cached for
 * a few minutes (see liveDataCache.ts) so switching between indicadores tabs
 * doesn't re-download the whole table every time.
 */
export function useLiveOpportunities() {
    const [opportunities, setOpportunities] = useState<LiveOpportunity[]>(
        () => getCachedRows<LiveOpportunity>(TABLE) || []
    );
    const [refreshToken, setRefreshToken] = useState(0);

    useEffect(() => onLiveDataRefresh(() => setRefreshToken(t => t + 1)), []);

    useEffect(() => {
        let active = true;
        fetchAllRowsCached<LiveOpportunity>(TABLE, SELECT_COLUMNS)
            .then(rows => {
                if (active) setOpportunities(rows);
            })
            .catch(err => console.error("[useLiveOpportunities] fetch failed:", err));
        return () => {
            active = false;
        };
    }, [refreshToken]);

    return { opportunities };
}
