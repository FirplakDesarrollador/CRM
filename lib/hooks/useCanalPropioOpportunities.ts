"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface CanalPropioOpportunity {
    id: string;
    owner_user_id: string | null;
    estado_id: number | null;
    fase_id: number | null;
    amount: number | null;
    fecha_cierre_estimada: string | null;
    created_at: string | null;
    is_deleted: boolean | null;
}

/**
 * Live (non-offline-cached) opportunities for a small, specific set of
 * advisors. Pages 3-5 of indicadores are scoped to the Canal Propio team
 * (a handful of advisors), and comparing against the source BI report showed
 * the local Dexie mirror can be stale/incomplete for this slice of data even
 * after a manual sync — so these report pages query Supabase directly
 * instead of going through the offline-first cache used elsewhere in the app.
 */
export function useCanalPropioOpportunities(ownerIds: string[]) {
    const [opportunities, setOpportunities] = useState<CanalPropioOpportunity[]>([]);
    const key = ownerIds.slice().sort().join(",");

    useEffect(() => {
        // Derive the id list from `key` itself (rather than closing over the
        // `ownerIds` prop) so the effect only needs `key` in its dependency
        // array and stays exhaustive-deps clean.
        const ids = key ? key.split(",") : [];
        let active = true;

        const request = ids.length > 0
            ? supabase
                .from("CRM_Oportunidades")
                .select("id, owner_user_id, estado_id, fase_id, amount, fecha_cierre_estimada, created_at, is_deleted")
                .in("owner_user_id", ids)
            : Promise.resolve({ data: [] as CanalPropioOpportunity[], error: null });

        request.then(({ data, error }) => {
            if (!active) return;
            if (!error) setOpportunities((data as CanalPropioOpportunity[]) || []);
        });

        return () => {
            active = false;
        };
    }, [key]);

    return { opportunities };
}
