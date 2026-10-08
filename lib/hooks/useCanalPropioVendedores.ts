"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TipoCanalVendedor = "Fisico" | "Online";

interface CanalVendedorRow {
    id: string;
    vendedor_id: string;
    canal_id: string;
    created_at: string | null;
    Tipo_Canal: TipoCanalVendedor | null;
}

/**
 * Advisors registered in CRM_Canales_Vendedores (the Canal Propio sales team),
 * each tagged as "Fisico" (in-store) or "Online". Used by the indicadores
 * report pages 3-5, which are scoped to this specific team only.
 */
export function useCanalPropioVendedores() {
    const [rows, setRows] = useState<CanalVendedorRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        supabase
            .from("CRM_Canales_Vendedores")
            .select("id, vendedor_id, canal_id, created_at, Tipo_Canal")
            .then(({ data, error }) => {
                if (!active) return;
                if (!error && data) setRows(data as CanalVendedorRow[]);
                setIsLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    // Keep only the most recent row per vendedor_id, in case of duplicates.
    const tipoByVendedor = useMemo(() => {
        const map = new Map<string, TipoCanalVendedor>();
        const latestAt = new Map<string, string>();
        rows.forEach(r => {
            if (!r.Tipo_Canal) return;
            const prevAt = latestAt.get(r.vendedor_id);
            const thisAt = r.created_at || "";
            if (!prevAt || thisAt > prevAt) {
                latestAt.set(r.vendedor_id, thisAt);
                map.set(r.vendedor_id, r.Tipo_Canal);
            }
        });
        return map;
    }, [rows]);

    const vendedorIds = useMemo(() => Array.from(tipoByVendedor.keys()), [tipoByVendedor]);

    return { tipoByVendedor, vendedorIds, isLoading };
}
