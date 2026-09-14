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
    const [isLoading, setIsLoading] = useState(true);
    const key = ownerIds.slice().sort().join(",");

    useEffect(() => {
        if (ownerIds.length === 0) {
            setOpportunities([]);
            setIsLoading(false);
            return;
        }
        let active = true;
        setIsLoading(true);
        supabase
            .from("CRM_Oportunidades")
            .select("id, owner_user_id, estado_id, fase_id, amount, fecha_cierre_estimada, created_at, is_deleted")
            .in("owner_user_id", ownerIds)
            .then(({ data, error }) => {
                if (!active) return;
                if (!error && data) setOpportunities(data as CanalPropioOpportunity[]);
                setIsLoading(false);
            });
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { opportunities, isLoading };
}
