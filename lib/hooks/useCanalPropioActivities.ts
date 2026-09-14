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
    const [isLoading, setIsLoading] = useState(true);
    const key = ownerIds.slice().sort().join(",");

    useEffect(() => {
        if (ownerIds.length === 0) {
            setActivities([]);
            setIsLoading(false);
            return;
        }
        let active = true;
        setIsLoading(true);
        supabase
            .from("CRM_Actividades")
            .select("id, user_id, tipo_actividad, is_completed, fecha_inicio, is_deleted")
            .in("user_id", ownerIds)
            .then(({ data, error }) => {
                if (!active) return;
                if (!error && data) setActivities(data as CanalPropioActivity[]);
                setIsLoading(false);
            });
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { activities, isLoading };
}
