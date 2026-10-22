"use client";

import { useEffect, useState } from "react";
import { fetchAllRowsCached, getCachedRows } from "./liveDataCache";

export interface LiveActivity {
    id: string;
    asunto: string | null;
    user_id: string | null;
    account_id: string | null;
    opportunity_id: string | null;
    tipo_actividad: "TAREA" | "EVENTO" | null;
    clasificacion_id: number | null;
    is_completed: boolean | null;
    fecha_inicio: string | null;
    is_deleted: boolean | null;
}

const TABLE = "CRM_Actividades";
const SELECT_COLUMNS = "id, asunto, user_id, account_id, opportunity_id, tipo_actividad, clasificacion_id, is_completed, fecha_inicio, is_deleted";

/**
 * Live (non-offline-cached) activities. Same rationale as
 * useLiveOpportunities: the offline Dexie mirror can be stale for this data
 * even right after a manual sync, so these indicadores report pages query
 * Supabase directly. Fetched in parallel pages and cached for a few minutes
 * (see liveDataCache.ts) so switching between indicadores tabs doesn't
 * re-download the whole table every time.
 */
export function useLiveActivities() {
    const [activities, setActivities] = useState<LiveActivity[]>(
        () => getCachedRows<LiveActivity>(TABLE) || []
    );

    useEffect(() => {
        let active = true;
        fetchAllRowsCached<LiveActivity>(TABLE, SELECT_COLUMNS)
            .then(rows => {
                if (active) setActivities(rows);
            })
            .catch(err => console.error("[useLiveActivities] fetch failed:", err));
        return () => {
            active = false;
        };
    }, []);

    return { activities };
}
