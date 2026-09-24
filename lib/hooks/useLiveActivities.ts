"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LiveActivity {
    id: string;
    user_id: string | null;
    account_id: string | null;
    opportunity_id: string | null;
    tipo_actividad: "TAREA" | "EVENTO" | null;
    clasificacion_id: number | null;
    is_completed: boolean | null;
    fecha_inicio: string | null;
    is_deleted: boolean | null;
}

const SELECT_COLUMNS = "id, user_id, account_id, opportunity_id, tipo_actividad, clasificacion_id, is_completed, fecha_inicio, is_deleted";
const PAGE_SIZE = 1000;

async function fetchAllActivities(): Promise<LiveActivity[]> {
    const rows: LiveActivity[] = [];
    let from = 0;
    // Supabase caps a single response at PAGE_SIZE rows; page through until a
    // short page tells us we've reached the end.
    while (true) {
        const { data, error } = await supabase
            .from("CRM_Actividades")
            .select(SELECT_COLUMNS)
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data as LiveActivity[]) || [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }
    return rows;
}

/**
 * Live (non-offline-cached) activities. Same rationale as
 * useLiveOpportunities: the offline Dexie mirror can be stale for this data
 * even right after a manual sync, so these indicadores report pages query
 * Supabase directly.
 */
export function useLiveActivities() {
    const [activities, setActivities] = useState<LiveActivity[]>([]);

    useEffect(() => {
        let active = true;
        fetchAllActivities()
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
