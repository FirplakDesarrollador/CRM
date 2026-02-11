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
    subclasificacion_id?: number | null; // Nuevo campo opcional
    es_premium?: boolean;
    nivel_premium?: 'ORO' | 'PLATA' | 'BRONCE' | null; // Nuevo campo jerárquico
    telefono?: string;
    direccion?: string;
    ciudad?: string; // Legacy/Text field
    ciudad_id?: number | null;
    departamento_id?: number | null;
    // ... other fields optional for now in local definition, or use 'any' schema
    _sync_metadata?: any;
    created_at?: string;
    created_by?: string;
    updated_by?: string;
    updated_at?: string;
}

export interface LocalDepartamento {
    id: number;
    nombre: string;
}

export interface LocalCiudad {
    id: number;
    departamento_id: number;
    nombre: string;
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
    segmento_id?: number | null; // Segmento del pedido/cotización

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
    probability?: number;
}

export interface LocalSubclasificacion {
    id: number;
    nombre: string;
    canal_id: string;
}

export interface LocalSegmento {
    id: number;
    nombre: string;
    subclasificacion_id: number;
}

export interface LocalOportunidad {
    id: string;
    account_id: string;
    fase_id: number;
    fase?: string; // Legacy/Join field
    nombre: string;
    valor: number; // Referred to as 'amount' in some places, need to standardize or allow both
    amount?: number; // Alias for valor to satisfy legacy code
    currency_id?: string;
    estado_id?: number;
    status?: string; // Legacy field
    fecha_cierre?: string;
    fecha_cierre_estimada?: string; // Alias
    items?: any[];
    owner_user_id?: string;
    segmento_id?: number | null;
    ciudad_id?: number | null;
    departamento_id?: number | null;
    created_at?: string;
    updated_at?: string;
    probability?: number;
    razon_perdida_id?: number | null;
    is_deleted?: boolean;
}

export class CRMFirplakDB extends Dexie {
    // Sync Queues
    outbox!: Table<OutboxItem, string>;
    fileQueue!: Table<any, string>;

    // Local Mirrors (Add more as needed)
    accounts!: Table<LocalCuenta, string>;
    opportunities!: Table<LocalOportunidad, string>;
    contacts!: Table<LocalContact, string>;
    quotes!: Table<LocalQuote, string>;
    quoteItems!: Table<LocalQuoteItem, string>;
    activities!: Table<any, string>; // We will stricter type this below
    phases!: Table<LocalFase, number>; // Local table
    subclasificaciones!: Table<LocalSubclasificacion, number>; // Local table
    segments!: Table<LocalSegmento, number>; // Local table
    departments!: Table<LocalDepartamento, number>;
    cities!: Table<LocalCiudad, number>;
    activityClassifications!: Table<LocalActivityClassification, number>;
    activitySubclassifications!: Table<LocalActivitySubclassification, number>;
    lossReasons!: Table<LocalLossReason, number>;
    opportunityCollaborators!: Table<LocalOpportunityCollaborator, string>; // New table

    constructor() {
        super('CRMFirplakDB');
        this.version(8).stores({
            outbox: 'id, entity_type, status, field_timestamp',
            fileQueue: 'id, status',
            accounts: 'id, nit, nombre',
            opportunities: 'id, account_id, owner_user_id', // Simplified index
            contacts: 'id, account_id, email',
            quotes: 'id, opportunity_id, status, es_pedido',
            quoteItems: 'id, cotizacion_id',
            activities: 'id, opportunity_id, user_id, fecha_inicio, tipo_actividad',
            phases: 'id, canal_id, orden',
            subclasificaciones: 'id, canal_id',
            segments: '++id, subclasificacion_id',
            departments: 'id, nombre',
            cities: 'id, departamento_id, nombre',
            activityClassifications: 'id, tipo_actividad',
            activitySubclassifications: 'id, clasificacion_id',
            lossReasons: 'id',
            opportunityCollaborators: 'id, oportunidad_id, usuario_id' // New table
        });
    }
}

export interface LocalOpportunityCollaborator {
    id: string;
    oportunidad_id: string;
    usuario_id: string;
    porcentaje: number;
    rol: string;
    created_at?: string;
    synced_at?: string;
    is_deleted?: boolean;
}

export interface LocalActivity {
    id: string;
    asunto: string;
    descripcion?: string;
    fecha_inicio: string;
    fecha_fin?: string;
    tipo_actividad: 'TAREA' | 'EVENTO';
    clasificacion_id?: number | null;
    subclasificacion_id?: number | null;
    is_completed: boolean;
    opportunity_id?: string;
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    is_deleted?: boolean;
}

export interface LocalActivityClassification {
    id: number;
    nombre: string;
    tipo_actividad: 'TAREA' | 'EVENTO';
}

export interface LocalActivitySubclassification {
    id: number;
    nombre: string;
    clasificacion_id: number;
}

export interface LocalLossReason {
    id: number;
    descripcion: string;
    is_active: boolean;
}

export const db = new CRMFirplakDB();
