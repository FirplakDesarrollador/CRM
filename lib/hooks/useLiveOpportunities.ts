"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LiveOpportunity {
    id: string;
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

const SELECT_COLUMNS = "id, account_id, owner_user_id, estado_id, fase_id, segmento_id, amount, fecha_cierre_estimada, created_at, is_deleted";
const PAGE_SIZE = 1000;

async function fetchAllOpportunities(): Promise<LiveOpportunity[]> {
    const rows: LiveOpportunity[] = [];
    let from = 0;
    // Supabase caps a single response at PAGE_SIZE rows; page through until a
    // short page tells us we've reached the end.
    while (true) {
        const { data, error } = await supabase
            .from("CRM_Oportunidades")
            .select(SELECT_COLUMNS)
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data as LiveOpportunity[]) || [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }
    return rows;
}

/**
 * Live (non-offline-cached) opportunities. Some indicadores report pages
 * compare their totals against a source BI report and found the local Dexie
 * mirror can be stale/incomplete even right after a manual sync — so those
 * pages query Supabase directly instead of going through the offline-first
 * cache used elsewhere in the app.
 */
export function useLiveOpportunities() {
    const [opportunities, setOpportunities] = useState<LiveOpportunity[]>([]);

    useEffect(() => {
        let active = true;
        fetchAllOpportunities()
            .then(rows => {
                if (active) setOpportunities(rows);
            })
            .catch(err => console.error("[useLiveOpportunities] fetch failed:", err));
        return () => {
            active = false;
        };
    }, []);

    return { opportunities };
}
