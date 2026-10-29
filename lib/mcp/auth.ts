/**
 * Resolución de sesión para el endpoint HTTP/SSE del Servidor MCP (app/api/mcp/route.ts).
 * Contrato de seguridad:
 *  - Un token Bearer solo autentica si Supabase Auth verifica su firma (auth.getUser).
 *  - Nunca se decodifica el payload de un JWT sin verificar la firma.
 *  - Los headers x-user-* solo valen en desarrollo con MCP_DEV_ALLOW_HEADERS=true,
 *    jamás en producción. Sin sesión válida se retorna null (el endpoint responde 401).
 */
import { createClient } from '@supabase/supabase-js';
import { McpSessionContext, McpUserRole } from './types';

export interface McpAuthUser {
  id: string;
  email?: string | null;
}

interface CrmUserRow {
  id?: string;
  email?: string;
  role?: string;
}

export interface McpAuthClient {
  auth: {
    getUser(token: string): Promise<{ data: { user: McpAuthUser | null }; error: unknown }>;
  };
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): { single(): Promise<{ data: CrmUserRow | null }> };
      ilike(col: string, val: string): { single(): Promise<{ data: CrmUserRow | null }> };
    };
  };
}

export interface ResolveMcpSessionOptions {
  token: string | null;
  headers: { get(name: string): string | null };
  env?: Record<string, string | undefined>;
  clientFactory?: (url: string, key: string) => McpAuthClient;
}

function defaultClientFactory(url: string, key: string): McpAuthClient {
  return createClient(url, key) as unknown as McpAuthClient;
}

async function resolveRoleFromCrmUsuarios(
  client: McpAuthClient,
  userId: string,
  email?: string | null
): Promise<string | undefined> {
  const { data: crmUser } = await client
    .from('CRM_Usuarios')
    .select('id, email, role')
    .eq('id', userId)
    .single();

  let resolvedRole = crmUser?.role;
  if (!resolvedRole && email) {
    const { data: crmUserByEmail } = await client
      .from('CRM_Usuarios')
      .select('id, email, role')
      .ilike('email', email)
      .single();
    resolvedRole = crmUserByEmail?.role;
  }
  return resolvedRole;
}

export async function resolveMcpSession(
  opts: ResolveMcpSessionOptions
): Promise<McpSessionContext | null> {
  const env = opts.env ?? process.env;
  const { token, headers } = opts;
  const clientFactory = opts.clientFactory ?? defaultClientFactory;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (token) {
    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      // Sin configuración no se puede verificar la firma: fallar cerrado.
      console.warn('[MCP-API] Token recibido pero falta configuración de Supabase; se rechaza.');
      return null;
    }
    try {
      const client = clientFactory(supabaseUrl, (serviceKey || anonKey)!);
      let verifiedUser: McpAuthUser | null = null;

      try {
        const res = await client.auth.getUser(token);
        if (res.data?.user && !res.error) {
          verifiedUser = res.data.user;
        }
      } catch {
        // Token expirado o inválido según Supabase Auth: no autentica.
      }

      if (!verifiedUser) {
        // La firma no fue verificada por Supabase Auth. Nunca decodificar el
        // payload del JWT como atajo: un token forjado o expirado no autentica,
        // y tampoco cae al fallback de desarrollo.
        return null;
      }

      const resolvedRole = await resolveRoleFromCrmUsuarios(client, verifiedUser.id, verifiedUser.email);
      const role: McpUserRole = (resolvedRole || 'VENDEDOR').toUpperCase() as McpUserRole;

      return {
        userId: verifiedUser.id,
        email: verifiedUser.email || 'comercial@firplak.com',
        role,
        transport: 'sse',
      };
    } catch (e) {
      console.warn('[MCP-API] No se pudo verificar token JWT:', e);
      return null;
    }
  }

  // Sin token: solo en desarrollo, con opt-in explícito, se aceptan headers de prueba.
  const devFallbackAllowed = env.MCP_DEV_ALLOW_HEADERS === 'true' && env.NODE_ENV !== 'production';
  if (!devFallbackAllowed) {
    return null;
  }

  const defaultEmail = headers.get('x-user-email') || env.CRM_USER_EMAIL || 'vendedor@firplak.com';
  let defaultRole = (headers.get('x-user-role') || env.CRM_USER_ROLE || 'VENDEDOR').toUpperCase() as McpUserRole;
  let defaultId = headers.get('x-user-id') || '11111111-1111-1111-1111-111111111111';

  if (supabaseUrl && (serviceKey || anonKey)) {
    try {
      const client = clientFactory(supabaseUrl, (serviceKey || anonKey)!);
      const { data: crmUser } = await client
        .from('CRM_Usuarios')
        .select('id, email, role')
        .ilike('email', defaultEmail)
        .single();
      if (crmUser?.role) {
        defaultRole = crmUser.role.toUpperCase() as McpUserRole;
      }
      if (crmUser?.id) {
        defaultId = crmUser.id;
      }
    } catch (e) {
      console.warn('[MCP-API] Error al resolver usuario fallback:', e);
    }
  }

  return {
    userId: defaultId,
    email: defaultEmail,
    role: defaultRole,
    transport: 'sse',
  };
}
