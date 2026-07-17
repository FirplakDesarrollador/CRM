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
    let query = supabase
        .from("CRM_InventarioDisponible")
        .select("producto_id, numero_articulo, descripcion, entradas, salidas, reservas, existencia_fisica, disponible")
        .order("numero_articulo");

    if (productIds?.length) query = query.in("producto_id", productIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(row => ({
        ...row,
        entradas: Number(row.entradas) || 0,
        salidas: Number(row.salidas) || 0,
        reservas: Number(row.reservas) || 0,
        existencia_fisica: Number(row.existencia_fisica) || 0,
        disponible: Number(row.disponible) || 0,
    })) as InventorySummary[];
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

export function useInventorySummary(productIds?: string[]) {
    const [summary, setSummary] = useState<InventorySummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const idsKey = productIds?.join(",") || "";
    const hasProductFilter = productIds !== undefined;

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setSummary(await fetchInventorySummary(idsKey ? idsKey.split(",") : hasProductFilter ? [] : undefined));
        } catch (queryError) {
            setSummary([]);
            setError(queryError instanceof Error ? queryError.message : "No se pudo consultar el inventario");
        } finally {
            setIsLoading(false);
        }
    }, [idsKey, hasProductFilter]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { summary, isLoading, error, refresh };
}
