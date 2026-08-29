import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalPedido, LocalPedidoItem, LocalQuote, LocalOportunidad } from "../db";
import { syncEngine } from "../sync";
import { v4 as uuidv4 } from 'uuid';

export function usePedidos(cotizacionId?: string) {
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
    }, [cotizacionId], []);

    const createPedido = async (
        parentQuote: LocalQuote, 
        selectedItems: { producto_id: string; cantidad: number; precio_unitario: number; descuento?: number }[],
        extraData?: Partial<LocalPedido>
    ) => {
        const uuid_generado = uuidv4();
        const opportunityId = parentQuote.opportunity_id;

        const newPedido: LocalPedido = {
            ...extraData,
            uuid_generado,
            cotizacion_id: parentQuote.id,
            opportunity_id: opportunityId,
            estado_pedido: 'PLANEADO',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Mapeo para Supabase (tablas legacy de Firplak con campos EXTRA_)
        const serverPayload: any = { 
            ...newPedido,
            id: undefined // Let server generate the BIGINT
        };
        
        const sapMapping: Record<string, string> = {
            'tipo_facturacion': 'EXTRA_Tipo de facturación',
            'incoterm': 'EXTRA_Incoterm/Incoterm',
            'notas_sap': 'EXTRA_Notas',
            'fecha_facturacion': 'EXTRA_Fecha de facturación',
            'orden_compra': 'EXTRA_Orden de compra/Purchase Order',
            'fecha_minima_requerida': 'EXTRA_Fecha mínima requerida por comercial/cliente',
            'formas_pago': 'EXTRA_Formas de pago',
            'terminos_pago': 'EXTRA_Terminos de pago/Pay Terms',
            'facturacion_electronica': 'EXTRA_Facturación Electrónica',
            'es_muestra': 'EXTRA_¿Es una muestra?',
            'aplica_contrato': 'EXTRA_¿Aplica contrato?',
            'multa_incumplimiento': 'EXTRA_¿Multa por incumplimiento?',
            'puerto_embarque': 'EXTRA_Puerto embarque/Shipment Port',
            'puerto_destino': 'EXTRA_Puerto destino/Destination Port',
            'via_transporte': 'EXTRA_Via/Type of transport',
            'flete': 'EXTRA_Flete/Freight',
            'seguro': 'EXTRA_Seguro/Insurance',
            'cierre_facturacion': 'EXTRA_Cierre Facturación'
        };

        Object.entries(sapMapping).forEach(([local, server]) => {
            if ((newPedido as any)[local] !== undefined) {
                serverPayload[server] = (newPedido as any)[local];
                delete serverPayload[local];
            }
        });

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

        await syncEngine.commitLocalChanges([db.pedidos, db.pedidoItems], async () => {
            await db.pedidos.add(newPedido);
            if (itemsToSave.length > 0) await db.pedidoItems.bulkAdd(itemsToSave);
            return [
                { entityTable: 'CRM_Pedidos', entityId: uuid_generado, changes: serverPayload, options: { isSnapshot: true } },
                ...itemsToSave.map(pdItem => ({
                    entityTable: 'CRM_PedidoItems', entityId: pdItem.id, changes: pdItem,
                    options: { isSnapshot: true }
                }))
            ];
        });

        return newPedido;
    };

    const updatePedido = async (uuid_generado: string, updates: Partial<LocalPedido>) => {
        const current = await db.pedidos.get(uuid_generado);
        if (!current) return;

        const merged = { ...current, ...updates, updated_at: new Date().toISOString() };

        // Mapeo para Supabase (tablas legacy de Firplak con campos EXTRA_)
        const serverPayload: any = { ...merged };
        // Remove internal Dexie fields if any (though here we use merged which is LocalPedido)
        delete serverPayload.id; // The server will identify by uuid_generado

        const sapMapping: Record<string, string> = {
            'tipo_facturacion': 'EXTRA_Tipo de facturación',
            'incoterm': 'EXTRA_Incoterm/Incoterm',
            'notas_sap': 'EXTRA_Notas',
            'fecha_facturacion': 'EXTRA_Fecha de facturación',
            'orden_compra': 'EXTRA_Orden de compra/Purchase Order',
            'fecha_minima_requerida': 'EXTRA_Fecha mínima requerida por comercial/cliente',
            'formas_pago': 'EXTRA_Formas de pago',
            'terminos_pago': 'EXTRA_Terminos de pago/Pay Terms',
            'facturacion_electronica': 'EXTRA_Facturación Electrónica',
            'es_muestra': 'EXTRA_¿Es una muestra?',
            'aplica_contrato': 'EXTRA_¿Aplica contrato?',
            'multa_incumplimiento': 'EXTRA_¿Multa por incumplimiento?',
            'puerto_embarque': 'EXTRA_Puerto embarque/Shipment Port',
            'puerto_destino': 'EXTRA_Puerto destino/Destination Port',
            'via_transporte': 'EXTRA_Via/Type of transport',
            'flete': 'EXTRA_Flete/Freight',
            'seguro': 'EXTRA_Seguro/Insurance',
            'cierre_facturacion': 'EXTRA_Cierre Facturación'
        };

        // Transferimos los valores a las columnas del servidor
        Object.entries(sapMapping).forEach(([local, server]) => {
            if (merged[local as keyof typeof merged] !== undefined) {
                serverPayload[server] = merged[local as keyof typeof merged];
                delete serverPayload[local];
            }
        });

        await syncEngine.commitLocalChanges([db.pedidos], async () => {
            await db.pedidos.put(merged);
            return [{
                entityTable: 'CRM_Pedidos', entityId: uuid_generado, changes: serverPayload,
                options: { isSnapshot: true }
            }];
        });
    };

    const deletePedido = async (uuid_generado: string) => {
        const pedido = await db.pedidos.get(uuid_generado);
        if (!pedido) return;
        const items = await db.pedidoItems.where('pedido_uuid').equals(uuid_generado).toArray();
        await syncEngine.commitLocalChanges([db.pedidos, db.pedidoItems], async () => {
            await db.pedidos.delete(uuid_generado);
            if (items.length > 0) await db.pedidoItems.bulkDelete(items.map(item => item.id));
            return [
                ...items.map(item => ({
                    entityTable: 'CRM_PedidoItems', entityId: item.id,
                    changes: { ...item, is_deleted: true }, options: { isSnapshot: true }
                })),
                {
                    entityTable: 'CRM_Pedidos', entityId: uuid_generado,
                    changes: { ...pedido, is_deleted: true }, options: { isSnapshot: true }
                }
            ];
        });
    };

    const updatePedidoItems = async (uuid_generado: string, newItems: { producto_id: string; cantidad: number; precio_unitario: number; descuento?: number }[]) => {
        await syncEngine.commitLocalChanges([db.pedidoItems], async () => {
            const currentItems = await db.pedidoItems.where('pedido_uuid').equals(uuid_generado).toArray();
            let remainingToSave = [...newItems];
            const requests = [];

            for (const currentItem of currentItems) {
                const updatedItemDef = remainingToSave.find(i => i.producto_id === currentItem.producto_id);
                if (updatedItemDef) {
                    const hasChanged = currentItem.cantidad !== updatedItemDef.cantidad
                        || currentItem.precio_unitario !== updatedItemDef.precio_unitario
                        || (currentItem.descuento || 0) !== (updatedItemDef.descuento || 0);
                    if (hasChanged) {
                        const updated = { ...currentItem, ...updatedItemDef, updated_at: new Date().toISOString() };
                        await db.pedidoItems.put(updated);
                        requests.push({ entityTable: 'CRM_PedidoItems', entityId: currentItem.id, changes: updated, options: { isSnapshot: true } });
                    }
                    remainingToSave = remainingToSave.filter(i => i.producto_id !== currentItem.producto_id);
                } else {
                    await db.pedidoItems.delete(currentItem.id);
                    requests.push({ entityTable: 'CRM_PedidoItems', entityId: currentItem.id, changes: { ...currentItem, is_deleted: true }, options: { isSnapshot: true } });
                }
            }

            const itemsToInsert = remainingToSave.map(item => ({
                id: uuidv4(), pedido_uuid: uuid_generado, producto_id: item.producto_id,
                cantidad: item.cantidad, precio_unitario: item.precio_unitario,
                descuento: item.descuento || 0, created_at: new Date().toISOString()
            }));
            if (itemsToInsert.length > 0) await db.pedidoItems.bulkAdd(itemsToInsert);
            requests.push(...itemsToInsert.map(pdItem => ({
                entityTable: 'CRM_PedidoItems', entityId: pdItem.id, changes: pdItem,
                options: { isSnapshot: true }
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
