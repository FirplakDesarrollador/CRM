import { useAuditLogStore } from './stores/useAuditLogStore';
import { useUserStore } from './stores/useUserStore';

export function registerAuditHooks(db: any) {
    const tableMapping: Record<string, string> = {
        'accounts': 'CRM_Cuentas',
        'opportunities': 'CRM_Oportunidades',
        'contacts': 'CRM_Contactos',
        'quotes': 'CRM_Cotizaciones',
        'quoteItems': 'CRM_CotizacionItems',
        'activities': 'CRM_Actividades',
        'pedidos': 'CRM_Pedidos',
        'pedidoItems': 'CRM_PedidoItems'
    };

    const targetTables = Object.keys(tableMapping);

    targetTables.forEach(tableName => {
        const table = db[tableName];
        if (!table) return;

        // Hook de Creación
        table.hook('creating', function (primKey: any, obj: any, transaction: any) {
            if (db.isPulling) return;

            const userEmail = useUserStore.getState().user?.email || 'Usuario Offline';
            const entityTable = tableMapping[tableName];

            // Clonar obj para evitar efectos secundarios en la base de datos
            const objClone = { ...obj };

            setTimeout(async () => {
                try {
                    let entityName = '';
                    let details = 'Creación del registro';

                    if (tableName === 'quoteItems' || tableName === 'pedidoItems') {
                        let parentContext = '';
                        if (tableName === 'quoteItems') {
                            const parentQuote = await db.quotes.get(objClone.cotizacion_id);
                            if (parentQuote) parentContext = ` en ${parentQuote.numero_cotizacion || 'Cotización'}`;
                        } else {
                            const parentPedido = await db.pedidos.where('uuid_generado').equals(objClone.pedido_uuid).first();
                            if (parentPedido) parentContext = ` en Pedido ${parentPedido.salesOrderNumber || parentPedido.id || ''}`;
                        }
                        const itemDesc = objClone.descripcion_linea || objClone.producto_id || 'Línea de producto';
                        entityName = `${itemDesc}${parentContext}`;
                        details = `Agregó item: ${itemDesc} x${objClone.cantidad || 0}`;
                    } else {
                        entityName = objClone.nombre || objClone.full_name || objClone.asunto || objClone.numero_cotizacion || objClone.salesOrderNumber || objClone.id || '';
                    }

                    useAuditLogStore.getState().addLog({
                        user_email: userEmail,
                        entity_type: entityTable,
                        entity_id: String(primKey || objClone.id || ''),
                        entity_name: entityName || 'Registro sin nombre',
                        action_type: 'CREATE',
                        details: details
                    });
                } catch (err) {
                    console.error('[AuditHook] Error in creating hook:', err);
                }
            }, 0);
        });

        // Hook de Edición
        table.hook('updating', function (mods: any, primKey: any, obj: any, transaction: any) {
            if (db.isPulling) return;

            const userEmail = useUserStore.getState().user?.email || 'Usuario Offline';
            const entityTable = tableMapping[tableName];

            // Clonar mods y obj para evitar accesos asíncronos fuera de transacción
            const modsClone = { ...mods };
            const objClone = { ...obj };

            setTimeout(async () => {
                try {
                    const ignoredFields = ['id', '_sync_metadata', 'updated_at', 'updated_by', 'created_at', 'created_by', 'cotizacion_id', 'pedido_uuid', 'pedido_id', 'opportunity_id', 'account_id'];
                    
                    const changedFields: string[] = [];
                    const detailsList: string[] = [];

                    for (const [key, val] of Object.entries(modsClone)) {
                        if (ignoredFields.includes(key) || val === undefined) continue;
                        
                        const oldVal = objClone[key];
                        const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : '';
                        const newStr = val !== null && val !== undefined ? String(val) : '';
                        
                        if (oldStr !== newStr) {
                            changedFields.push(key);
                            if (oldStr.length < 25 && newStr.length < 25) {
                                detailsList.push(`${key} (${oldStr} → ${newStr})`);
                            } else {
                                detailsList.push(key);
                            }
                        }
                    }

                    if (changedFields.length === 0) return;

                    let entityName = '';
                    if (tableName === 'quoteItems' || tableName === 'pedidoItems') {
                        let parentContext = '';
                        if (tableName === 'quoteItems') {
                            const parentQuote = await db.quotes.get(objClone.cotizacion_id);
                            if (parentQuote) parentContext = ` en ${parentQuote.numero_cotizacion || 'Cotización'}`;
                        } else {
                            const parentPedido = await db.pedidos.where('uuid_generado').equals(objClone.pedido_uuid).first();
                            if (parentPedido) parentContext = ` en Pedido ${parentPedido.salesOrderNumber || parentPedido.id || ''}`;
                        }
                        const itemDesc = objClone.descripcion_linea || objClone.producto_id || 'Línea de producto';
                        entityName = `${itemDesc}${parentContext}`;
                    } else {
                        entityName = objClone.nombre || objClone.full_name || objClone.asunto || objClone.numero_cotizacion || objClone.salesOrderNumber || objClone.id || '';
                    }

                    useAuditLogStore.getState().addLog({
                        user_email: userEmail,
                        entity_type: entityTable,
                        entity_id: String(primKey || objClone.id || ''),
                        entity_name: entityName || 'Registro sin nombre',
                        action_type: 'UPDATE',
                        details: `Modificó: ${detailsList.join(', ')}`
                    });
                } catch (err) {
                    console.error('[AuditHook] Error in updating hook:', err);
                }
            }, 0);
        });
    });
}
