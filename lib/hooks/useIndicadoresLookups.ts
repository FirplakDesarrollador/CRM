"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useUsers } from "@/lib/hooks/useUsers";

export interface IndicadoresChannel {
    id: string;
    nombre: string;
}

export interface IndicadoresAccountInfo {
    canal_id?: string | null;
    subclasificacion_id?: number | null;
    nombre?: string | null;
}

/**
 * Shared lookup data (channels, phases, subclassifications, segments, users,
 * accounts map) for the native indicadores report pages that replace the
 * embedded Power BI iframe.
 */
export function useIndicadoresLookups() {
    const phases = useLiveQuery(() => db.phases.toArray());
    const subclasificaciones = useLiveQuery(() => db.subclasificaciones.toArray());
    const segments = useLiveQuery(() => db.segments.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const activityClassifications = useLiveQuery(() => db.activityClassifications.toArray());
    const { users, isLoading: isLoadingUsers } = useUsers();

    const [channels, setChannels] = useState<IndicadoresChannel[]>([]);
    useEffect(() => {
        let active = true;
        supabase
            .from("CRM_Canales")
            .select("id, nombre")
            .order("nombre")
            .then(({ data }) => {
                if (active && data) setChannels(data as IndicadoresChannel[]);
            });
        return () => {
            active = false;
        };
    }, []);

    const accountsMap = useMemo(() => {
        const map = new Map<string, IndicadoresAccountInfo>();
        (accounts || []).forEach(a => {
            map.set(a.id, {
                canal_id: a.canal_id,
                subclasificacion_id: a.subclasificacion_id,
                nombre: a.nombre,
            });
        });
        return map;
    }, [accounts]);

    const activeUsers = useMemo(
        () =>
            (users || [])
                .filter(u => u.is_active !== false)
                .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)),
        [users]
    );

    return {
        phases: phases || [],
        subclasificaciones: subclasificaciones || [],
        segments: segments || [],
        activityClassifications: activityClassifications || [],
        channels,
        users: activeUsers,
        accountsMap,
        isLoading: isLoadingUsers,
    };
}
