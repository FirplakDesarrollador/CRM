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
        selectedItems: { producto_id: string; cantidad: number; precio_unitario: number; descuento?: number }[]
    ) => {
        const uuid_generado = uuidv4();
        const opportunityId = parentQuote.opportunity_id;

        const newPedido: LocalPedido = {
            uuid_generado,
            cotizacion_id: parentQuote.id,
            opportunity_id: opportunityId,
            estado_pedido: 'PLANEADO',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add Pedido locally
        await db.pedidos.add(newPedido);
        
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
            'terminos_pago': 'EXTRA_Terminos de pago/Pay Terms'
        };

        Object.entries(sapMapping).forEach(([local, server]) => {
            if ((newPedido as any)[local] !== undefined) {
                serverPayload[server] = (newPedido as any)[local];
                delete serverPayload[local];
            }
        });

        // Add to sync queue for CRM_Pedidos (Snapshot mode for new records)
        await syncEngine.queueMutation('CRM_Pedidos', uuid_generado, serverPayload, { isSnapshot: true });

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

        await db.pedidoItems.bulkAdd(itemsToSave);
        
        // Sync items (Snapshot mode for new records)
        for (const pdItem of itemsToSave) {
            await syncEngine.queueMutation('CRM_PedidoItems', pdItem.id, pdItem, { isSnapshot: true });
        }

        return newPedido;
    };

    const updatePedido = async (uuid_generado: string, updates: Partial<LocalPedido>) => {
        const current = await db.pedidos.get(uuid_generado);
        if (!current) return;

        const merged = { ...current, ...updates, updated_at: new Date().toISOString() };
        await db.pedidos.put(merged);

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
            'terminos_pago': 'EXTRA_Terminos de pago/Pay Terms'
        };

        // Transferimos los valores a las columnas del servidor
        Object.entries(sapMapping).forEach(([local, server]) => {
            if (merged[local as keyof typeof merged] !== undefined) {
                serverPayload[server] = merged[local as keyof typeof merged];
                delete serverPayload[local];
            }
        });

        console.log('[usePedidos] Mapped atomic payload for server:', serverPayload);
        await syncEngine.queueMutation('CRM_Pedidos', uuid_generado, serverPayload, { isSnapshot: true });
    };

    const deletePedido = async (uuid_generado: string) => {
        await db.pedidos.delete(uuid_generado);
        // Cascades normally locally if we do it, but manually let's just delete items to be safe
        const items = await db.pedidoItems.where('pedido_uuid').equals(uuid_generado).toArray();
        for (const item of items) {
            await db.pedidoItems.delete(item.id);
            await syncEngine.queueMutation('CRM_PedidoItems', item.id, { is_deleted: true });
        }
        await syncEngine.queueMutation('CRM_Pedidos', uuid_generado, { is_deleted: true });
    };

    return {
        pedidosCollection,
        createPedido,
        updatePedido,
        deletePedido
    };
}
