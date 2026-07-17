"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface OpportunityOrigin {
    id: string;
    codigo: string;
    nombre: string;
    orden: number;
    is_active: boolean;
}

export function useOpportunityOrigins(includeInactive = false) {
    const [origins, setOrigins] = useState<OpportunityOrigin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        let query = supabase
            .from("CRM_OrigenesOportunidad")
            .select("id, codigo, nombre, orden, is_active")
            .order("orden")
            .order("nombre");

        if (!includeInactive) query = query.eq("is_active", true);

        const { data, error: queryError } = await query;
        if (queryError) {
            setError(queryError.message);
            setOrigins([]);
        } else {
            setOrigins((data || []) as OpportunityOrigin[]);
        }
        setIsLoading(false);
    }, [includeInactive]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void refresh(), 0);
        return () => window.clearTimeout(timeout);
    }, [refresh]);

    return { origins, isLoading, error, refresh };
}
