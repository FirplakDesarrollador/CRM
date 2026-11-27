"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface CrmZone {
    id: string;
    codigo: string;
    nombre: string;
    orden: number;
    is_active: boolean;
}

const ZONES_CACHE_KEY = "crm_cached_zones";

function getCachedZones(): CrmZone[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(ZONES_CACHE_KEY);
        return raw ? (JSON.parse(raw) as CrmZone[]) : [];
    } catch {
        return [];
    }
}

function setCachedZones(zones: CrmZone[]) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(ZONES_CACHE_KEY, JSON.stringify(zones));
    } catch (e) {
        console.warn("[useZones] Failed to cache zones:", e);
    }
}

export function useZones(includeInactive = false) {
    const [zones, setZones] = useState<CrmZone[]>(() => {
        const cached = getCachedZones();
        return includeInactive ? cached : cached.filter((z) => z.is_active);
    });
    const [isLoading, setIsLoading] = useState(() => getCachedZones().length === 0);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (getCachedZones().length === 0) {
            setIsLoading(true);
        }
        setError(null);

        try {
            let query = supabase
                .from("CRM_Zonas")
                .select("id, codigo, nombre, orden, is_active")
                .order("orden")
                .order("nombre");

            if (!includeInactive) {
                query = query.eq("is_active", true);
            }

            const { data, error: queryError } = await query;
            if (queryError) {
                if (getCachedZones().length === 0) {
                    setError(queryError.message);
                    setZones([]);
                }
            } else if (data) {
                const typed = data as CrmZone[];
                setZones(typed);
                if (includeInactive) {
                    setCachedZones(typed);
                } else if (getCachedZones().length === 0) {
                    setCachedZones(typed);
                }
            }
        } catch (err: unknown) {
            if (getCachedZones().length === 0) {
                setError(err instanceof Error ? err.message : "Error al cargar zonas");
            }
        } finally {
            setIsLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void refresh(), 0);
        return () => window.clearTimeout(timeout);
    }, [refresh]);

    return { zones, isLoading, error, refresh };
}
