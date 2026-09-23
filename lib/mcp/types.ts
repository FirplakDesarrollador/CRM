/**
 * Tipos y definiciones de contexto para el Servidor MCP de CRM FIRPLAK
 */

export type McpUserRole = 'VENDEDOR' | 'COORDINADOR' | 'ADMIN' | 'ADMINISTRADOR';

export interface McpSessionContext {
  userId: string;
  email: string;
  role: McpUserRole;
  transport?: 'stdio' | 'sse' | 'test';
}

export interface McpToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Estructuras de respuesta compacta para protección de contexto
export interface CompactOpportunity {
  id: string;
  nombre: string;
  cuenta_id: string;
  cuenta_nombre?: string;
  canal_id: string;
  fase_id: number;
  fase_nombre?: string;
  estado_id?: number;
  estado_nombre?: string;
  valor: number;
  fecha_cierre?: string;
  owner_user_id?: string;
  owner_nombre?: string;
  probability?: number;
  origen_oportunidad?: string | null;
  actividades_resumen?: {
    atrasadas: number;
    programadas: number;
    completadas: number;
  };
}

export interface CompactAccount {
  id: string;
  nombre: string;
  nit: string;
  canal_id: string;
  canal_nombre?: string;
  ciudad?: string;
  nivel_premium?: 'PREMIUM' | 'DESTACADO' | 'ACTIVO' | null;
  owner_user_id?: string;
  owner_nombre?: string;
  telefono?: string;
  email?: string;
}

export interface CompactContact {
  id: string;
  account_id: string;
  cuenta_nombre?: string;
  nombre: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  es_principal?: boolean;
}

export interface CompactActivity {
  id: string;
  asunto: string;
  tipo_actividad: 'TAREA' | 'EVENTO';
  prioridad?: 'Alta' | 'Media' | 'Baja' | null;
  fecha_inicio: string;
  fecha_fin?: string;
  is_completed: boolean;
  opportunity_id?: string;
  account_id?: string;
  user_id?: string;
  clasificacion_nombre?: string;
}

export const VERCEL_MCP_PRODUCTION_URL = 'https://crm-64yu.vercel.app';

/**
 * Resuelve la URL pública del endpoint MCP.
 * Si el entorno actual es localhost o 127.0.0.1, asegura que retorne la URL desplegada en Vercel.
 */
export function getMcpPublicUrl(origin?: string): string {
  const targetBase = VERCEL_MCP_PRODUCTION_URL;
  if (!origin) return `${targetBase}/api/mcp`;

  const lower = origin.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0')) {
    return `${targetBase}/api/mcp`;
  }

  return `${origin.replace(/\/+$/, '')}/api/mcp`;
}
