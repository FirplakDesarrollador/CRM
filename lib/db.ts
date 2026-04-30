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
    status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';
    retry_count: number;
    error?: string;
}

export interface LocalCuenta {
    id: string;
    nombre: string;
    nit: string;
    nit_base?: string;
    id_cuenta_principal?: string | null;
    owner_user_id?: string; // Nuevo campo propietario
    canal_id: string; // Nuevo campo obligatorio
    subclasificacion_id?: number | null; // Nuevo campo opcional
    es_premium?: boolean;
    nivel_premium?: 'PREMIUM' | 'DESTACADO' | 'ACTIVO' | null; // Nuevo campo jerárquico
    ignorar_limites_descuento?: boolean; // Toggle para saltar límites de descuento
    telefono?: string;
    email?: string; // Added field
    direccion?: string;
    ciudad?: string; // Legacy/Text field
    ciudad_id?: number | null;
    departamento_id?: number | null;
    pais_id?: number | null;
    // ... other fields optional for now in local definition, or use 'any' schema
    _sync_metadata?: any;
    created_at?: string;
    created_by?: string;
    updated_by?: string;
    updated_at?: string;
    comentarios?: string;
}

export interface LocalPais {
    id: number;
    nombre: string;
}

export interface LocalDepartamento {
    id: number;
    pais_id: number;
    nombre: string;
}

export interface LocalCiudad {
    id: number;
    departamento_id: number;
    nombre: string;
}

// Types for Quotes
export interface LocalQuote {
    comentarios?: string;
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

    // PDF / F-V-29 Nuevos Campos
    cliente_final?: string;
    email_contacto?: string;
    contacto_ventas?: string;
    contacto_logistico?: string;
    contacto_tesoreria?: string;
    dir_envio_factura_tipo?: string;
    servicio_subida_hidromasaje?: boolean;
    piso_entrega?: number;
    tiene_escaleras?: boolean;
    planos_hidromasaje?: string;
    fecha_entrega?: string;
    nit_cliente_final?: string;
    entrega_en_obra?: boolean;
    bodega_externa?: boolean;
    bodega_firplak?: boolean;

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

export interface LocalPedido {
    id?: number;
    uuid_generado: string;
    cotizacion_id: string;
    opportunity_id?: string;
    estado_pedido: 'PLANEADO' | 'ENVIADO_SAP' | null;
    
    // Legacy fields
    salesOrderNumber?: string;
    reference?: string;
    stateSalesOrder?: string;
    amountSalesOrder?: string;
    company?: string;
    opportunity?: string;

    // SAP Data (mapped to EXTRA_...)
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

    currency_id?: string;
    responsible?: string;
    "EXTRA_Gran Total"?: string;

    // Nuevos campos F-V-29
    cliente_final?: string;
    email_contacto?: string;
    contacto_ventas?: string;
    contacto_logistico?: string;
    contacto_tesoreria?: string;
    dir_envio_factura_tipo?: string;
    servicio_subida_hidromasaje?: boolean;
    piso_entrega?: number;
    tiene_escaleras?: boolean;
    planos_hidromasaje?: string;
    fecha_entrega?: string;
    nit_cliente_final?: string;
    entrega_en_obra?: boolean;
    bodega_externa?: boolean;
    bodega_firplak?: boolean;

    created_by?: string;
    updated_by?: string;
    updated_at?: string;
    created_at?: string;
}

export interface LocalPedidoItem {
    id: string;
    pedido_uuid: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
    created_at?: string;
}

// Types for Contacts
export interface LocalContact {
    comentarios?: string;
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
    pais_id?: number | null;
    departamento_id?: number | null;
    ciudad_id?: number | null;
    created_at?: string;
    updated_at?: string;
    probability?: number;
    razon_perdida_id?: number | null;
    razon_perdida?: string | null;
    comentarios_perdida?: string | null;
    is_deleted?: boolean;
    origen_oportunidad?: string | null;
    url_origen?: string | null;
    fuente_conversion?: string | null;
    created_by?: string;
    updated_by?: string;
    comentarios?: string;
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
    countries!: Table<LocalPais, number>; // Local table
    departments!: Table<LocalDepartamento, number>;
    cities!: Table<LocalCiudad, number>;
    activityClassifications!: Table<LocalActivityClassification, number>;
    activitySubclassifications!: Table<LocalActivitySubclassification, number>;
    lossReasons!: Table<LocalLossReason, number>;
    opportunityCollaborators!: Table<LocalOpportunityCollaborator, string>; // New table
    pedidos!: Table<LocalPedido, string>;
    pedidoItems!: Table<LocalPedidoItem, string>;

    constructor() {
        super('CRMFirplakDB');
        this.version(11).stores({
            outbox: 'id, entity_type, status, field_timestamp, field_name',
            fileQueue: 'id, status',
            accounts: 'id, nit, nombre, owner_user_id',
            opportunities: 'id, account_id, owner_user_id', // Simplified index
            contacts: 'id, account_id, email',
            quotes: 'id, opportunity_id, status, es_pedido',
            quoteItems: 'id, cotizacion_id',
            activities: 'id, opportunity_id, user_id, fecha_inicio, tipo_actividad',
            phases: 'id, canal_id, orden',
            subclasificaciones: 'id, canal_id',
            segments: '++id, subclasificacion_id',
            countries: 'id',
            departments: 'id, pais_id, nombre',
            cities: 'id, departamento_id, nombre',
            activityClassifications: 'id, tipo_actividad',
            activitySubclassifications: 'id, clasificacion_id',
            lossReasons: 'id',
            opportunityCollaborators: 'id, oportunidad_id, usuario_id', // New table
            pedidos: 'uuid_generado, cotizacion_id, opportunity_id',
            pedidoItems: 'id, pedido_uuid'
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
    prioridad?: 'Alta' | 'Media' | 'Baja' | null;
    clasificacion_id?: number | null;
    subclasificacion_id?: number | null;
    is_completed: boolean;
    opportunity_id?: string;
    account_id?: string;
    user_id?: string;
    ms_planner_id?: string | null;
    ms_event_id?: string | null;
    _sync_metadata?: any;
    teams_meeting_url?: string | null;
    Tarea_planner?: boolean | null;
    created_at?: string;
    updated_at?: string;
    is_deleted?: boolean;
}

export interface LocalActivityClassification {
    id: number;
    nombre: string;
    tipo_actividad: 'TAREA' | 'EVENTO';
    is_deleted?: boolean;
}

export interface LocalActivitySubclassification {
    id: number;
    nombre: string;
    clasificacion_id: number;
    is_deleted?: boolean;
}

export interface LocalLossReason {
    id: number;
    descripcion: string;
    is_active: boolean;
}

export const db = new CRMFirplakDB();
