/**
 * Adaptador de base de datos para el MCP del CRM FIRPLAK
 * Conecta con Supabase y proporciona almacenamiento idempotente y catálogos estáticos.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Catálogos oficiales del CRM FIRPLAK
export const CANALES_REFERENCIA = [
  { id: 'OBRAS_NAC', nombre: 'Obras Nacionales', columna_precio: 'PRECIO_OBRAS_NAC' },
  { id: 'OBRAS_INT', nombre: 'Obras Internacionales', columna_precio: 'PRECIO_OBRAS_INT' },
  { id: 'DIST_NAC', nombre: 'Distribución Nacional', columna_precio: 'PRECIO_DIST_NAC' },
  { id: 'DIST_INT', nombre: 'Distribución Internacional', columna_precio: 'PRECIO_DIST_INT' },
  { id: 'PROPIO', nombre: 'Puntos Propios / Retail', columna_precio: 'PRECIO_PROPIO' },
];

export const FASES_POR_CANAL: Record<string, Array<{ id: number; nombre: string; orden: number; probability: number }>> = {
  OBRAS_NAC: [
    { id: 1, nombre: 'Calificación / Prospección', orden: 1, probability: 10 },
    { id: 2, nombre: 'Especificación y Diseño', orden: 2, probability: 30 },
    { id: 3, nombre: 'Cotización Presentada', orden: 3, probability: 50 },
    { id: 4, nombre: 'Negociación y Ajuste', orden: 4, probability: 75 },
    { id: 5, nombre: 'Cierre Ganado', orden: 5, probability: 100 },
  ],
  DIST_NAC: [
    { id: 10, nombre: 'Contacto Comercial', orden: 1, probability: 10 },
    { id: 11, nombre: 'Muestras y Catálogo', orden: 2, probability: 30 },
    { id: 12, nombre: 'Propuesta de Pedido', orden: 3, probability: 50 },
    { id: 13, nombre: 'Negociación de Descuento', orden: 4, probability: 75 },
    { id: 14, nombre: 'Cierre Ganado', orden: 5, probability: 100 },
  ],
  DIST_INT: [
    { id: 20, nombre: 'Prospección Internacional', orden: 1, probability: 10 },
    { id: 21, nombre: 'Homologación y Flete', orden: 2, probability: 35 },
    { id: 22, nombre: 'Oferta Exportación', orden: 3, probability: 60 },
    { id: 23, nombre: 'Cierre Ganado', orden: 4, probability: 100 },
  ],
  OBRAS_INT: [
    { id: 30, nombre: 'Contacto Obra Exterior', orden: 1, probability: 10 },
    { id: 31, nombre: 'Cálculo Logístico e Incoterm', orden: 2, probability: 40 },
    { id: 32, nombre: 'Cotización F-V-29', orden: 3, probability: 70 },
    { id: 33, nombre: 'Cierre Ganado', orden: 4, probability: 100 },
  ],
  PROPIO: [
    { id: 40, nombre: 'Lead / Asesoría en Tienda', orden: 1, probability: 20 },
    { id: 41, nombre: 'Diseño y Modulación', orden: 2, probability: 50 },
    { id: 42, nombre: 'Cotización Aprobada', orden: 3, probability: 80 },
    { id: 43, nombre: 'Cierre Ganado', orden: 4, probability: 100 },
  ],
};

export const CLASIFICACIONES_ACTIVIDAD = [
  { id: 1, nombre: 'Llamada Comercial', tipo: 'TAREA' },
  { id: 2, nombre: 'Visita a Obra / Cliente', tipo: 'EVENTO' },
  { id: 3, nombre: 'Reunión Virtual Teams', tipo: 'EVENTO' },
  { id: 4, nombre: 'Envío de Cotización y Seguimiento', tipo: 'TAREA' },
  { id: 5, nombre: 'Comité Técnico / Entrega', tipo: 'EVENTO' },
];

export const MOTIVOS_PERDIDA = [
  { id: 1, descripcion: 'Precio superior a la competencia' },
  { id: 2, descripcion: 'Tiempos de entrega no ajustados a obra' },
  { id: 3, descripcion: 'Especificación técnica o diseño descartado' },
  { id: 4, descripcion: 'Proyecto cancelado o suspendido por cliente' },
  { id: 5, descripcion: 'Presupuesto insuficiente' },
];

export const ORIGENES_OPORTUNIDAD = [
  { id: 1, nombre: 'Prospección Directa (Outbound)' },
  { id: 2, nombre: 'Web / Formulario Firplak' },
  { id: 3, nombre: 'Referido de Obra' },
  { id: 4, nombre: 'Feria Comercial' },
  { id: 5, nombre: 'Tienda Propia' },
];

export interface OpportunityRecord {
  id: string;
  nombre: string;
  canal_id: string;
  fase_id?: number;
  valor?: number;
  probabilidad?: number;
  contacto_id?: string;
  account_id?: string;
  assigned_to?: string;
  owner_user_id?: string;
  estado?: string;
  motivo_perdida?: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AccountRecord {
  id: string;
  nombre: string;
  nit?: string;
  telefono?: string;
  direccion?: string;
  tipo_cuenta?: string;
  categoria?: 'PREMIUM' | 'DESTACADO' | 'ACTIVO' | null;
  nivel_premium?: 'PREMIUM' | 'DESTACADO' | 'ACTIVO' | null;
  assigned_to?: string;
  owner_user_id?: string;
  ciudad?: string;
  email?: string;
  sitio_web?: string;
  canal_id?: string;
  activo?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ContactRecord {
  id: string;
  nombre: string;
  apellido?: string;
  account_id?: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  departamento?: string;
  es_principal?: boolean;
  is_primary?: boolean;
  assigned_to?: string;
  owner_user_id?: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ActivityRecord {
  id: string;
  asunto: string;
  tipo_actividad: 'TAREA' | 'EVENTO';
  prioridad?: 'Alta' | 'Media' | 'Baja' | null;
  clasificacion_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  is_completed?: boolean;
  notas?: string;
  descripcion?: string;
  assigned_to?: string;
  owner_user_id?: string;
  user_id?: string;
  opportunity_id?: string;
  account_id?: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// Almacén en memoria para pruebas e idempotencia rápida
export interface MemoryStore {
  opportunities: Map<string, OpportunityRecord>;
  accounts: Map<string, AccountRecord>;
  contacts: Map<string, ContactRecord>;
  activities: Map<string, ActivityRecord>;
  idempotency: Map<string, Record<string, unknown>>;
  config: Map<string, unknown>;
}

export function createMemoryStore(): MemoryStore {
  const store: MemoryStore = {
    opportunities: new Map(),
    accounts: new Map(),
    contacts: new Map(),
    activities: new Map(),
    idempotency: new Map(),
    config: new Map([
      ['min_premium_order_value', 15000000],
      ['dias_inactividad_alerta', 15],
    ]),
  };

  // Semilla de prueba
  store.accounts.set('acc-uuid-1', {
    id: 'acc-uuid-1',
    nombre: 'Constructora Bolívar S.A.',
    nit: '860002145-1',
    canal_id: 'OBRAS_NAC',
    ciudad: 'Bogotá',
    nivel_premium: 'PREMIUM',
    owner_user_id: '11111111-1111-1111-1111-111111111111',
    is_deleted: false,
    activo: true,
  });

  store.contacts.set('con-uuid-1', {
    id: 'con-uuid-1',
    account_id: 'acc-uuid-1',
    nombre: 'Carlos',
    apellido: 'Gómez',
    email: 'carlos.gomez@constructora.com',
    telefono: '3104567890',
    cargo: 'Director de Compras',
    es_principal: true,
    is_deleted: false,
  });

  store.opportunities.set('opp-archivada-1', {
    id: 'opp-archivada-1',
    nombre: 'Edificio Residencial Las Palmas',
    account_id: 'acc-uuid-1',
    canal_id: 'OBRAS_NAC',
    fase_id: 1,
    estado_id: 2, // Perdida
    valor: 45000000,
    razon_perdida_id: 1,
    comentarios_perdida: 'Cliente prefirió alternativa económica',
    owner_user_id: '11111111-1111-1111-1111-111111111111',
    is_deleted: true,
  });

  store.opportunities.set('opp-otro-vendedor', {
    id: 'opp-otro-vendedor',
    nombre: 'Torres del Parque Obra 4',
    account_id: 'acc-uuid-1',
    canal_id: 'OBRAS_NAC',
    fase_id: 2,
    estado_id: 1,
    valor: 80000000,
    owner_user_id: '99999999-9999-9999-9999-999999999999', // Otro vendedor
    is_deleted: false,
  });

  return store;
}

export class CrmDatabaseAdapter {
  private memory: MemoryStore;
  private supabaseClient: SupabaseClient | null = null;

  constructor() {
    this.memory = createMemoryStore();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && serviceKey && !url.includes('example.supabase.co')) {
      try {
        this.supabaseClient = createClient(url, serviceKey, {
          auth: { persistSession: false },
        });
      } catch {
        this.supabaseClient = null;
      }
    }
  }

  getSupabase(): SupabaseClient | null {
    return this.supabaseClient;
  }

  getMemory(): MemoryStore {
    return this.memory;
  }
}
