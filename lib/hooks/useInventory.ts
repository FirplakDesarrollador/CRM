"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type InventoryOperation = "ENTRADA" | "SALIDA" | "RESERVA";
export type InventoryMovementStatus = "ACTIVO" | "CANCELADO";

export interface InventorySummary {
    producto_id: string;
    numero_articulo: string;
    descripcion: string;
    entradas: number;
    salidas: number;
    reservas: number;
    existencia_fisica: number;
    disponible: number;
}

export interface InventoryMovement {
    id: string;
    producto_id: string;
    operacion: InventoryOperation;
    cantidad: number;
    estado: InventoryMovementStatus;
    referencia_tipo: string | null;
    referencia_id: string | null;
    notas: string | null;
    created_at: string;
    updated_at: string;
    producto?: { numero_articulo: string; descripcion: string } | null;
}

export interface InventoryMovementInput {
    producto_id: string;
    operacion: InventoryOperation;
    cantidad: number;
    estado?: InventoryMovementStatus;
    referencia_tipo?: string | null;
    referencia_id?: string | null;
    notas?: string | null;
}

export async function fetchInventorySummary(productIds?: string[]) {
    if (productIds && productIds.length === 0) return [];
    try {
        let query = supabase
            .from("CRM_InventarioDisponible")
            .select("producto_id, numero_articulo, descripcion, entradas, salidas, reservas, existencia_fisica, disponible")
            .order("numero_articulo");

        if (productIds?.length) {
            query = query.in("producto_id", productIds);
        } else {
            query = query.or("entradas.gt.0,salidas.gt.0,reservas.gt.0,existencia_fisica.gt.0,disponible.gt.0").limit(10000);
        }
        const { data, error } = await query;
        if (error) {
            console.warn("Error consultando CRM_InventarioDisponible:", error.message);
            return [];
        }
        return (data || []).map(row => ({
            ...row,
            entradas: Number(row.entradas) || 0,
            salidas: Number(row.salidas) || 0,
            reservas: Number(row.reservas) || 0,
            existencia_fisica: Number(row.existencia_fisica) || 0,
            disponible: Number(row.disponible) || 0,
        })) as InventorySummary[];
    } catch (err) {
        console.warn("Exception al consultar inventario:", err);
        return [];
    }
}

export async function createInventoryMovement(input: InventoryMovementInput) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("No hay un usuario autenticado");

    const { error } = await supabase.from("CRM_InventarioMovimientos").insert({
        ...input,
        estado: input.estado || "ACTIVO",
        created_by: authData.user.id,
        updated_by: authData.user.id,
    });
    if (error) throw error;
}

export async function reserveFairInventory(
    items: Array<{ product_id: string; cantidad: number; nombre?: string }>,
    opportunityId: string,
) {
    const { error } = await supabase.rpc("reservar_inventario_feria", {
        p_items: items,
        p_opportunity_id: opportunityId,
    });
    if (error) throw error;
}

let globalInventorySummaryCache: InventorySummary[] | null = null;
let globalInventoryPromise: Promise<InventorySummary[]> | null = null;

export async function fetchInventorySummaryCached(force = false): Promise<InventorySummary[]> {
    if (!force && globalInventorySummaryCache) return globalInventorySummaryCache;
    if (!force && globalInventoryPromise) return globalInventoryPromise;

    globalInventoryPromise = (async () => {
        try {
            const data = await fetchInventorySummary();
            globalInventorySummaryCache = data;
            return data;
        } finally {
            globalInventoryPromise = null;
        }
    })();

    return globalInventoryPromise;
}

export function useInventorySummary(productIds?: string[]) {
    const idsKey = productIds?.join(",") || "";
    const hasProductFilter = productIds !== undefined;
    const isGlobal = !hasProductFilter;

    const [summary, setSummary] = useState<InventorySummary[]>(() => {
        if (isGlobal && globalInventorySummaryCache) return globalInventorySummaryCache;
        return [];
    });
    const [isLoading, setIsLoading] = useState(() => {
        if (isGlobal && globalInventorySummaryCache) return false;
        return true;
    });
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (isGlobal) {
                const data = await fetchInventorySummaryCached(true);
                setSummary(data);
            } else {
                setSummary(await fetchInventorySummary(idsKey ? idsKey.split(",") : hasProductFilter ? [] : undefined));
            }
        } catch (queryError) {
            setSummary([]);
            setError(queryError instanceof Error ? queryError.message : "No se pudo consultar el inventario");
        } finally {
            setIsLoading(false);
        }
    }, [idsKey, hasProductFilter, isGlobal]);

    useEffect(() => {
        if (isGlobal && globalInventorySummaryCache) {
            setSummary(globalInventorySummaryCache);
            setIsLoading(false);
            // Re-fetch in background without showing loader
            fetchInventorySummaryCached(true).then(data => setSummary(data)).catch(() => {});
            return;
        }
        void refresh();
    }, [refresh, isGlobal]);

    return { summary, isLoading, error, refresh };
}
