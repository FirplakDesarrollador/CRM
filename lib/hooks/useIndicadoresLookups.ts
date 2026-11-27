"use client";

import { useEffect, useMemo, useState } from "react";
import type {
    LocalPhase,
    LocalSubclasificacion,
    LocalSegment,
    LocalActivityClassification,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useUsers } from "@/lib/hooks/useUsers";

export interface IndicadoresChannel {
    id: string;
    nombre: string;
}

export interface IndicadoresAccountInfo {
    canal_id?: string | null;
    subclasificacion_id?: number | null;
    departamento_id?: number | null;
    owner_user_id?: string | null;
    nombre?: string | null;
}

/**
 * Shared lookup data (channels, phases, subclassifications, segments, users,
 * accounts map) for the native indicadores report pages that replace the
 * embedded Power BI iframe.
 */
export function useIndicadoresLookups() {
    const [phases, setPhases] = useState<LocalPhase[]>([]);
    const [subclasificaciones, setSubclasificaciones] = useState<LocalSubclasificacion[]>([]);
    const [segments, setSegments] = useState<LocalSegment[]>([]);
    const [accounts, setAccounts] = useState<Array<{ id: string } & IndicadoresAccountInfo>>([]);
    const [activityClassifications, setActivityClassifications] = useState<LocalActivityClassification[]>([]);
    const { users, isLoading: isLoadingUsers } = useUsers();

    const [channels, setChannels] = useState<IndicadoresChannel[]>([]);
    useEffect(() => {
        let active = true;
        Promise.all([
            supabase.from("CRM_Canales").select("id, nombre").order("nombre"),
            supabase.from("CRM_FasesOportunidad").select("*"),
            supabase.from("CRM_Subclasificacion").select("*"),
            supabase.from("CRM_Segmentos").select("*"),
            supabase.from("CRM_Activity_Clasificacion").select("*"),
            supabase
                .from("CRM_Cuentas")
                .select("id, canal_id, subclasificacion_id, departamento_id, owner_user_id, nombre")
                .eq("is_deleted", false),
        ]).then(([channelsRes, phasesRes, subclasRes, segmentsRes, actClassRes, accountsRes]) => {
            if (!active) return;
            if (channelsRes.data) setChannels(channelsRes.data as IndicadoresChannel[]);
            if (phasesRes.data) setPhases(phasesRes.data as LocalPhase[]);
            if (subclasRes.data) setSubclasificaciones(subclasRes.data as LocalSubclasificacion[]);
            if (segmentsRes.data) setSegments(segmentsRes.data as LocalSegment[]);
            if (actClassRes.data) setActivityClassifications(actClassRes.data as LocalActivityClassification[]);
            if (accountsRes.data) setAccounts(accountsRes.data as Array<{ id: string } & IndicadoresAccountInfo>);
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
                departamento_id: a.departamento_id,
                owner_user_id: a.owner_user_id,
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
