"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface OpportunityOrigin {
    id: string;
    codigo: string;
    nombre: string;
    orden: number;
    is_active: boolean;
    is_default?: boolean;
}

const ORIGINS_CACHE_KEY = 'crm_cached_opportunity_origins';

function getCachedOrigins(): OpportunityOrigin[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(ORIGINS_CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function setCachedOrigins(origins: OpportunityOrigin[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(ORIGINS_CACHE_KEY, JSON.stringify(origins));
    } catch (e) {
        console.warn('[useOpportunityOrigins] Failed to cache origins:', e);
    }
}

export function useOpportunityOrigins(includeInactive = false) {
    const [origins, setOrigins] = useState<OpportunityOrigin[]>(() => getCachedOrigins());
    const [isLoading, setIsLoading] = useState(() => getCachedOrigins().length === 0);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (origins.length === 0) {
            setIsLoading(true);
        }
        setError(null);

        try {
            let query = supabase
                .from("CRM_OrigenesOportunidad")
                .select("id, codigo, nombre, orden, is_active, is_default")
                .order("orden")
                .order("nombre");

            if (!includeInactive) query = query.eq("is_active", true);

            const { data, error: queryError } = await query;
            if (queryError) {
                if (getCachedOrigins().length === 0) {
                    setError(queryError.message);
                    setOrigins([]);
                }
            } else if (data) {
                setOrigins(data as OpportunityOrigin[]);
                setCachedOrigins(data as OpportunityOrigin[]);
            }
        } catch (err: any) {
            if (getCachedOrigins().length === 0) {
                setError(err?.message || "Error al cargar orígenes");
            }
        } finally {
            setIsLoading(false);
        }
    }, [includeInactive, origins.length]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void refresh(), 0);
        return () => window.clearTimeout(timeout);
    }, [refresh]);

    return { origins, isLoading, error, refresh };
}
