import { describe, it, expect } from 'vitest';
import { resolveMcpSession, McpAuthClient, McpAuthUser } from '@/lib/mcp/auth';

/**
 * Contrato de seguridad del endpoint HTTP /api/mcp (incidente 2026-10-28):
 *  1. Un JWT cuya firma no verifica Supabase Auth (forjado o expirado) NUNCA autentica,
 *     aunque su payload tenga un `iss` del proyecto. (Bypass introducido en a0ee90b.)
 *  2. Sin token, los headers x-user-* NO otorgan sesión salvo en desarrollo explícito
 *     (MCP_DEV_ALLOW_HEADERS=true y NODE_ENV !== 'production').
 */

const SUPABASE_URL = 'https://abcproyecto.supabase.co';

const BASE_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-prueba',
  NODE_ENV: 'production',
};

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** JWT estructuralmente válido con iss del proyecto, pero con firma inventada. */
function forgedToken(sub: string, email: string): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    sub,
    email,
    iss: `${SUPABASE_URL}/auth/v1`,
    role: 'authenticated',
    exp: 9999999999,
  });
  return `${header}.${payload}.firma-falsificada`;
}

function makeHeaders(map: Record<string, string> = {}) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

interface MockClientOptions {
  /** Usuario que auth.getUser retorna cuando la firma del token es válida. */
  validUser?: McpAuthUser | null;
  getUserThrows?: boolean;
  /** Fila de CRM_Usuarios resuelta por id. */
  rowById?: { id?: string; email?: string; role?: string } | null;
  /** Fila de CRM_Usuarios resuelta por email (ilike). */
  rowByEmail?: { id?: string; email?: string; role?: string } | null;
}

function makeMockClient(opts: MockClientOptions): McpAuthClient {
  return {
    auth: {
      async getUser() {
        if (opts.getUserThrows) throw new Error('token is expired');
        if (opts.validUser) return { data: { user: opts.validUser }, error: null };
        return { data: { user: null }, error: { message: 'invalid JWT: signature is invalid' } };
      },
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return { single: async () => ({ data: opts.rowById ?? null }) };
            },
            ilike() {
              return { single: async () => ({ data: opts.rowByEmail ?? null }) };
            },
          };
        },
      };
    },
  };
}

describe('Resolución de sesión MCP (/api/mcp) — contrato de seguridad', () => {
  describe('1. JWT sin firma verificada jamás autentica', () => {
    it('rechaza un JWT forjado con iss del proyecto cuando getUser no lo valida', async () => {
      const client = makeMockClient({
        validUser: null,
        rowById: { id: 'x', role: 'ADMIN' },
      });
      const session = await resolveMcpSession({
        token: forgedToken('99999999-9999-4999-8999-999999999999', 'atacante@evil.com'),
        headers: makeHeaders(),
        env: BASE_ENV,
        clientFactory: () => client,
      });
      expect(session).toBeNull();
    });

    it('rechaza un token expirado sin revivirlo decodificando el payload', async () => {
      const client = makeMockClient({ getUserThrows: true });
      const session = await resolveMcpSession({
        token: forgedToken('44444444-4444-4444-4444-444444444444', 'vendedor@firplak.com'),
        headers: makeHeaders(),
        env: BASE_ENV,
        clientFactory: () => client,
      });
      expect(session).toBeNull();
    });

    it('un token inválido tampoco cae al fallback de headers', async () => {
      const client = makeMockClient({ validUser: null });
      const session = await resolveMcpSession({
        token: 'token-basura',
        headers: makeHeaders({ 'x-user-role': 'ADMIN', 'x-user-email': 'admin@firplak.com' }),
        env: { ...BASE_ENV, NODE_ENV: 'development', MCP_DEV_ALLOW_HEADERS: 'true' },
        clientFactory: () => client,
      });
      expect(session).toBeNull();
    });
  });

  describe('2. Sin token no hay sesión anónima ni headers espía', () => {
    it('en producción los headers x-user-* no otorgan sesión', async () => {
      const client = makeMockClient({
        rowByEmail: { id: '33333333-3333-3333-3333-333333333333', role: 'ADMIN' },
      });
      const session = await resolveMcpSession({
        token: null,
        headers: makeHeaders({ 'x-user-role': 'ADMIN', 'x-user-email': 'admin@firplak.com' }),
        env: BASE_ENV,
        clientFactory: () => client,
      });
      expect(session).toBeNull();
    });

    it('fuera de producción sin MCP_DEV_ALLOW_HEADERS tampoco hay fallback', async () => {
      const client = makeMockClient({});
      const session = await resolveMcpSession({
        token: null,
        headers: makeHeaders({ 'x-user-role': 'ADMIN' }),
        env: { ...BASE_ENV, NODE_ENV: 'development' },
        clientFactory: () => client,
      });
      expect(session).toBeNull();
    });

    it('con MCP_DEV_ALLOW_HEADERS=true en desarrollo sí permite el fallback de pruebas', async () => {
      const client = makeMockClient({
        rowByEmail: { id: '22222222-2222-2222-2222-222222222222', role: 'COORDINADOR' },
      });
      const session = await resolveMcpSession({
        token: null,
        headers: makeHeaders({ 'x-user-email': 'coordinador@firplak.com' }),
        env: { ...BASE_ENV, NODE_ENV: 'development', MCP_DEV_ALLOW_HEADERS: 'true' },
        clientFactory: () => client,
      });
      expect(session).not.toBeNull();
      expect(session?.role).toBe('COORDINADOR');
      expect(session?.userId).toBe('22222222-2222-2222-2222-222222222222');
    });

    it('MCP_DEV_ALLOW_HEADERS=true NO habilita el fallback en producción', async () => {
      const client = makeMockClient({
        rowByEmail: { id: '33333333-3333-3333-3333-333333333333', role: 'ADMIN' },
      });
      const session = await resolveMcpSession({
        token: null,
        headers: makeHeaders({ 'x-user-role': 'ADMIN' }),
        env: { ...BASE_ENV, NODE_ENV: 'production', MCP_DEV_ALLOW_HEADERS: 'true' },
        clientFactory: () => client,
      });
      expect(session).toBeNull();
    });
  });

  describe('3. El flujo legítimo con token verificado se preserva (bug histórico rol→role)', () => {
    it('token válido resuelve rol ADMIN desde CRM_Usuarios por id', async () => {
      const client = makeMockClient({
        validUser: { id: '33333333-3333-3333-3333-333333333333', email: 'admin@firplak.com' },
        rowById: { id: '33333333-3333-3333-3333-333333333333', role: 'ADMIN' },
      });
      const session = await resolveMcpSession({
        token: 'token-real-verificado',
        headers: makeHeaders(),
        env: BASE_ENV,
        clientFactory: () => client,
      });
      expect(session?.userId).toBe('33333333-3333-3333-3333-333333333333');
      expect(session?.role).toBe('ADMIN');
    });

    it('token válido sin fila por id resuelve rol por email (ilike)', async () => {
      const client = makeMockClient({
        validUser: { id: '55555555-5555-4555-8555-555555555555', email: 'Ismael.Correa@firplak.com' },
        rowById: null,
        rowByEmail: { id: '55555555-5555-4555-8555-555555555555', role: 'ADMIN' },
      });
      const session = await resolveMcpSession({
        token: 'token-real-verificado',
        headers: makeHeaders(),
        env: BASE_ENV,
        clientFactory: () => client,
      });
      expect(session?.role).toBe('ADMIN');
    });

    it('token válido sin fila en CRM_Usuarios usa VENDEDOR por defecto', async () => {
      const client = makeMockClient({
        validUser: { id: '66666666-6666-4666-8666-666666666666', email: 'nuevo@firplak.com' },
      });
      const session = await resolveMcpSession({
        token: 'token-real-verificado',
        headers: makeHeaders(),
        env: BASE_ENV,
        clientFactory: () => client,
      });
      expect(session?.role).toBe('VENDEDOR');
    });
  });
});
