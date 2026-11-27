import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalPedido, LocalPedidoItem, LocalQuote } from "../db";
import { executeDirectMutations, fetchRecordDirect, DirectMutationRequest } from "../supabaseDirect";
import { supabase } from "../supabase";
import { v4 as uuidv4 } from 'uuid';
import { mapPedidoServerPayload } from "../pedidoHelpers";

export function usePedidos(cotizacionId?: string) {
    // Direct Supabase fetch for pedidos and pedidoItems of this quote
    useEffect(() => {
        if (!cotizacionId || typeof window === 'undefined' || !navigator.onLine) return;
        if (process.env.NODE_ENV !== 'production' && window.location?.pathname?.startsWith('/e2e/')) return;

        let cancelled = false;
        const loadPedidos = async () => {
            try {
                const { data: pedidosData, error: pedErr } = await supabase
                    .from('CRM_Pedidos')
                    .select('*')
                    .eq('cotizacion_id', cotizacionId)
                    .eq('is_deleted', false);

                if (!cancelled && !pedErr && Array.isArray(pedidosData) && pedidosData.length > 0) {
                    await db.pedidos.bulkPut(pedidosData as LocalPedido[]);
                    const uuids = pedidosData.map((p: { uuid_generado?: string }) => p.uuid_generado).filter(Boolean) as string[];
                    if (uuids.length > 0) {
                        const { data: itemsData, error: itemErr } = await supabase
                            .from('CRM_PedidoItems')
                            .select('*')
                            .in('pedido_uuid', uuids)
                            .eq('is_deleted', false);
                        if (!cancelled && !itemErr && Array.isArray(itemsData) && itemsData.length > 0) {
                            await db.pedidoItems.bulkPut(itemsData as LocalPedidoItem[]);
                        }
                    }
                }
            } catch (err) {
                console.warn('[usePedidos] Direct Supabase load warning:', err);
            }
        };
        void loadPedidos();
        return () => {
            cancelled = true;
        };
    }, [cotizacionId]);

    const pedidosCollection = useLiveQuery(async () => {
        if (!cotizacionId) return [];

        const pedidos = await db.pedidos
            .where('cotizacion_id')
            .equals(cotizacionId)
            .toArray();

        // Join items for each
        const withItems = await Promise.all(pedidos.map(async (ped) => {
            const items = await db.pedidoItems
                .where('pedido_uuid')
                .equals(ped.uuid_generado)
                .toArray();
            return {
                ...ped,
                items
            };
        }));
        
        return withItems;
    }, [cotizacionId]);

    const createPedido = async (
        parentQuote: LocalQuote, 
        selectedItems: { producto_id: string; cantidad: number; precio_unitario: number; descuento?: number }[],
        logisticsData: Partial<LocalPedido> = {}
    ) => {
        const uuid_generado = uuidv4();
        const opportunityId = parentQuote.opportunity_id;

        const rawPedido: LocalPedido = {
            ...logisticsData,
            uuid_generado,
            cotizacion_id: parentQuote.id,
            opportunity_id: opportunityId,
            estado_pedido: 'PLANEADO',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { localMerged: newPedido, serverPayload } = mapPedidoServerPayload(rawPedido);

        // Add Items
        const itemsToSave: LocalPedidoItem[] = selectedItems.map(item => ({
            id: uuidv4(),
            pedido_uuid: uuid_generado,
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento: item.descuento || 0,
            created_at: new Date().toISOString()
        }));

        await executeDirectMutations(async () => {
            await db.pedidos.put(newPedido as LocalPedido);
            if (itemsToSave.length > 0) await db.pedidoItems.bulkPut(itemsToSave);
            return [
                { entityTable: 'CRM_Pedidos', entityId: uuid_generado, changes: serverPayload as unknown as Record<string, unknown> },
                ...itemsToSave.map(pdItem => ({
                    entityTable: 'CRM_PedidoItems' as const,
                    entityId: pdItem.id,
                    changes: pdItem as unknown as Record<string, unknown>,
                }))
            ];
        });

        return newPedido as LocalPedido;
    };

    const updatePedido = async (uuid_generado: string, updates: Partial<LocalPedido>) => {
        const current = (await db.pedidos.get(uuid_generado)) || (await fetchRecordDirect<LocalPedido>('CRM_Pedidos', uuid_generado));
        if (!current) return;

        const { localMerged: merged, serverPayload } = mapPedidoServerPayload({
            ...current,
            ...updates,
            updated_at: new Date().toISOString()
        });

        await executeDirectMutations(async () => {
            await db.pedidos.put(merged as LocalPedido);
            return [{
                entityTable: 'CRM_Pedidos',
                entityId: uuid_generado,
                changes: serverPayload as unknown as Record<string, unknown>,
            }];
        });
    };

    const deletePedido = async (uuid_generado: string) => {
        const pedido = (await db.pedidos.get(uuid_generado)) || (await fetchRecordDirect<LocalPedido>('CRM_Pedidos', uuid_generado));
        if (!pedido) return;
        const items = await db.pedidoItems.where('pedido_uuid').equals(uuid_generado).toArray();
        await executeDirectMutations(async () => {
            await db.pedidos.delete(uuid_generado);
            if (items.length > 0) await db.pedidoItems.bulkDelete(items.map(item => item.id));
            return [
                ...items.map(item => ({
                    entityTable: 'CRM_PedidoItems' as const,
                    entityId: item.id,
                    changes: { ...item, is_deleted: true } as unknown as Record<string, unknown>,
                })),
                {
                    entityTable: 'CRM_Pedidos',
                    entityId: uuid_generado,
                    changes: { ...pedido, is_deleted: true } as unknown as Record<string, unknown>,
                }
            ];
        });
    };

    const updatePedidoItems = async (uuid_generado: string, newItems: { producto_id: string; cantidad: number; precio_unitario: number; descuento?: number }[]) => {
        await executeDirectMutations(async () => {
            const currentItems = await db.pedidoItems.where('pedido_uuid').equals(uuid_generado).toArray();
            let remainingToSave = [...newItems];
            const requests: DirectMutationRequest[] = [];

            for (const currentItem of currentItems) {
                const updatedItemDef = remainingToSave.find(i => i.producto_id === currentItem.producto_id);
                if (updatedItemDef) {
                    const hasChanged = currentItem.cantidad !== updatedItemDef.cantidad
                        || currentItem.precio_unitario !== updatedItemDef.precio_unitario
                        || (currentItem.descuento || 0) !== (updatedItemDef.descuento || 0);
                    if (hasChanged) {
                        const updated = { ...currentItem, ...updatedItemDef, updated_at: new Date().toISOString() };
                        await db.pedidoItems.put(updated);
                        requests.push({ entityTable: 'CRM_PedidoItems', entityId: currentItem.id, changes: updated as unknown as Record<string, unknown> });
                    }
                    remainingToSave = remainingToSave.filter(i => i.producto_id !== currentItem.producto_id);
                } else {
                    await db.pedidoItems.delete(currentItem.id);
                    requests.push({ entityTable: 'CRM_PedidoItems', entityId: currentItem.id, changes: { ...currentItem, is_deleted: true } as unknown as Record<string, unknown> });
                }
            }

            const itemsToInsert = remainingToSave.map(item => ({
                id: uuidv4(), pedido_uuid: uuid_generado, producto_id: item.producto_id,
                cantidad: item.cantidad, precio_unitario: item.precio_unitario,
                descuento: item.descuento || 0, created_at: new Date().toISOString()
            }));
            if (itemsToInsert.length > 0) await db.pedidoItems.bulkPut(itemsToInsert);
            requests.push(...itemsToInsert.map(pdItem => ({
                entityTable: 'CRM_PedidoItems' as const,
                entityId: pdItem.id,
                changes: pdItem as unknown as Record<string, unknown>,
            })));
            return requests;
        });
    };

    return {
        pedidosCollection,
        createPedido,
        updatePedido,
        updatePedidoItems,
        deletePedido
    };
}
