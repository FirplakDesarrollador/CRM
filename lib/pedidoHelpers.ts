import { LocalPedido } from './db';

/**
 * Normaliza cualquier formato de fecha (SAP DD/MM/YYYY, ISO 8601, timestamp)
 * a formato YYYY-MM-DD requerido estrictamente por inputs HTML5 type="date".
 */
export function normalizeDateToInput(dateStr: string | null | undefined): string {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const trimmed = dateStr.trim();
    if (!trimmed) return '';

    // Si ya es YYYY-MM-DD o ISO con fecha inicial YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Formato SAP latinoamericano DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Intento con Date.parse estándar
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return '';
}

/**
 * Mapea y sincroniza un pedido para persistencia local en Dexie y remota en Supabase.
 * Asegura que los campos de entrega y las columnas nativas booleanas se mantengan intactas.
 */
export function mapPedidoServerPayload(merged: Partial<LocalPedido>): {
    localMerged: Partial<LocalPedido>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serverPayload: Record<string, any>;
} {
    const localMerged: Partial<LocalPedido> = { ...merged };

    // Sincronizar bidireccionalmente fecha_entrega y fecha_minima_requerida
    const fechaVal = localMerged.fecha_entrega ?? localMerged.fecha_minima_requerida;
    if (fechaVal !== undefined) {
        localMerged.fecha_entrega = fechaVal;
        localMerged.fecha_minima_requerida = fechaVal;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverPayload: Record<string, any> = { ...localMerged };
    delete serverPayload.id;

    if (fechaVal !== undefined) {
        serverPayload['EXTRA_Fecha mínima requerida por comercial/cliente'] = fechaVal;
        serverPayload['fecha_entrega'] = fechaVal;
    }

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

    // Columnas nativas de CRM_Pedidos en Supabase que deben preservarse en serverPayload
    const preserveNativeKeys = new Set([
        'cierre_facturacion',
        'es_muestra',
        'fecha_entrega',
        'fecha_facturacion',
        'tipo_facturacion',
        'orden_compra',
        'incoterm',
        'notas_sap'
    ]);

    Object.entries(sapMapping).forEach(([local, server]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((localMerged as any)[local] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serverPayload[server] = (localMerged as any)[local];
            if (!preserveNativeKeys.has(local)) {
                delete serverPayload[local];
            }
        }
    });

    return { localMerged, serverPayload };
}
