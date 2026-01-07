import Dexie, { Table } from 'dexie';

// Define Types for Local Tables (Mirroring Server)
// We add 'sync_status' to track if a row is fully synced or has pending changes (though Outbox is primary)

export interface OutboxItem {
    id: string; // uuid
    entity_type: string; // Table Name e.g. 'CRM_Cuentas'
    entity_id: string;
    field_name: string;
    old_value: any;
    new_value: any;
    field_timestamp: number;
    user_id?: string;
    status: 'PENDING' | 'SYNCING' | 'FAILED';
    retry_count: number;
    error?: string;
}

export interface LocalCuenta {
    id: string;
    nombre: string;
    nit: string;
    // ... other fields optional for now in local definition, or use 'any' schema
    _sync_metadata?: any;
    updated_at?: string;
}

// Types for Quotes
export interface LocalQuote {
    id: string;
    opportunity_id: string;
    numero_cotizacion: string;
    total_amount: number;
    currency_id: string;
    status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'WINNER';
    is_winner?: boolean;

    // SAP Data
    fecha_minima_requerida?: string;
    fecha_facturacion?: string;
    tipo_facturacion?: string;
    notas_sap?: string;
    formas_pago?: string;
    facturacion_electronica?: boolean;
    oc_cot?: string;
    cierre_facturacion?: string;
    es_muestra?: boolean;
    aplica_contrato?: boolean;
    multa_incumplimiento?: boolean;
    orden_compra?: string;
    puerto_embarque?: string;
    terminos_pago?: string;
    puerto_destino?: string;
    via_transporte?: string;
    flete?: number;
    incoterm?: string;
    seguro?: number;

    updated_at?: string;
}

export interface LocalQuoteItem {
    id: string;
    cotizacion_id: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    descripcion_linea?: string;
}

export class CRMFirplakDB extends Dexie {
    // Sync Queues
    outbox!: Table<OutboxItem, string>;
    fileQueue!: Table<any, string>;

    // Local Mirrors (Add more as needed)
    accounts!: Table<LocalCuenta, string>;
    opportunities!: Table<any, string>;
    contacts!: Table<any, string>;
    quotes!: Table<LocalQuote, string>;
    quoteItems!: Table<LocalQuoteItem, string>;
    activities!: Table<any, string>;

    constructor() {
        super('CRMFirplakDB');
        this.version(4).stores({
            outbox: 'id, entity_type, status, field_timestamp',
            fileQueue: 'id, status',
            accounts: 'id, nit, nombre',
            opportunities: 'id, account_id, owner_user_id, items',
            contacts: 'id, account_id, email',
            quotes: 'id, opportunity_id, status',
            quoteItems: 'id, cotizacion_id',
            activities: 'id, opportunity_id, user_id, fecha_inicio'
        });
    }
}

export const db = new CRMFirplakDB();
