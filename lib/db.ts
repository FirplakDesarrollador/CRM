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
    nit_base?: string;
    id_cuenta_principal?: string | null;
    canal_id: string; // Nuevo campo obligatorio
    es_premium?: boolean;
    telefono?: string;
    direccion?: string;
    ciudad?: string;
    // ... other fields optional for now in local definition, or use 'any' schema
    _sync_metadata?: any;
    created_by?: string;
    updated_by?: string;
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
    es_pedido?: boolean; // Nuevo campo para diferenciar pedidos

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

    created_by?: string;
    updated_by?: string;
    updated_at?: string;
}

export interface LocalQuoteItem {
    id: string;
    cotizacion_id: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    discount_pct?: number;
    max_discount_pct?: number;
    final_unit_price?: number;
    descripcion_linea?: string;
    created_by?: string;
    updated_by?: string;
    updated_at?: string;
}

// Types for Contacts
export interface LocalContact {
    id: string;
    account_id: string;
    nombre: string;
    cargo?: string;
    email?: string;
    telefono?: string;
    es_principal?: boolean;
    created_by?: string;
    updated_by?: string;
    updated_at?: string;
}

export interface LocalFase {
    id: number;
    nombre: string;
    orden: number;
    is_active: boolean;
    canal_id: string;
}

export class CRMFirplakDB extends Dexie {
    // Sync Queues
    outbox!: Table<OutboxItem, string>;
    fileQueue!: Table<any, string>;

    // Local Mirrors (Add more as needed)
    accounts!: Table<LocalCuenta, string>;
    opportunities!: Table<any, string>;
    contacts!: Table<LocalContact, string>;
    quotes!: Table<LocalQuote, string>;
    quoteItems!: Table<LocalQuoteItem, string>;
    activities!: Table<any, string>;
    phases!: Table<LocalFase, number>; // Local table

    constructor() {
        super('CRMFirplakDB');
        this.version(5).stores({ // Bumped version to 5
            outbox: 'id, entity_type, status, field_timestamp',
            fileQueue: 'id, status',
            accounts: 'id, nit, nombre',
            opportunities: 'id, account_id, owner_user_id, items',
            contacts: 'id, account_id, email',
            quotes: 'id, opportunity_id, status, es_pedido', // Added es_pedido index
            quoteItems: 'id, cotizacion_id',
            activities: 'id, opportunity_id, user_id, fecha_inicio',
            phases: 'id, canal_id, orden'
        });
    }
}

export const db = new CRMFirplakDB();
