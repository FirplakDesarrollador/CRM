"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface CanalPropioActivity {
    id: string;
    user_id: string | null;
    tipo_actividad: "TAREA" | "EVENTO" | null;
    is_completed: boolean | null;
    fecha_inicio: string | null;
    is_deleted: boolean | null;
}

/**
 * Live (non-offline-cached) activities for a small, specific set of advisors.
 * Same rationale as useCanalPropioOpportunities: the offline Dexie mirror can
 * be stale for this slice of data even right after a manual sync, so the
 * indicadores report pages for the Canal Propio team query Supabase directly.
 */
export function useCanalPropioActivities(ownerIds: string[]) {
    const [activities, setActivities] = useState<CanalPropioActivity[]>([]);
    const key = ownerIds.slice().sort().join(",");

    useEffect(() => {
        // Derive the id list from `key` itself (rather than closing over the
        // `ownerIds` prop) so the effect only needs `key` in its dependency
        // array and stays exhaustive-deps clean.
        const ids = key ? key.split(",") : [];
        let active = true;

        const request = ids.length > 0
            ? supabase
                .from("CRM_Actividades")
                .select("id, user_id, tipo_actividad, is_completed, fecha_inicio, is_deleted")
                .in("user_id", ids)
            : Promise.resolve({ data: [] as CanalPropioActivity[], error: null });

        request.then(({ data, error }) => {
            if (!active) return;
            if (!error) setActivities((data as CanalPropioActivity[]) || []);
        });

        return () => {
            active = false;
        };
    }, [key]);

    return { activities };
}
