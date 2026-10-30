import { describe, it, expect, vi } from 'vitest';
import { getMcpPersonalToken, getMcpSessionToken, formatBearerAuthHeader, isTokenExpired } from '@/lib/mcp/token';
import {
  createMcpPersonalToken,
  parseMcpPersonalToken,
  verifyMcpPersonalTokenHash,
} from '@/lib/mcp/personal-token';

describe('MCP Authentication Token Helper', () => {
  it('formats bearer authorization header correctly', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample';
    expect(formatBearerAuthHeader(token)).toBe(`Bearer ${token}`);
  });

  it('determines if token is expired accurately', () => {
    const pastTime = Math.floor(Date.now() / 1000) - 300; // 5 mins ago
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour ahead
    
    expect(isTokenExpired(pastTime)).toBe(true);
    expect(isTokenExpired(futureTime)).toBe(false);
    expect(isTokenExpired(null)).toBe(true);
  });

  it('retrieves active session token from supabase auth client', async () => {
    const mockSession = {
      access_token: 'mock-access-token-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
    };

    const res = await getMcpSessionToken(mockSupabase as unknown as Parameters<typeof getMcpSessionToken>[0]);
    expect(res.token).toBe('mock-access-token-123');
    expect(res.isExpired).toBe(false);
    expect(res.error).toBeNull();
  });

  it('handles missing session gracefully', async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    };

    const res = await getMcpSessionToken(mockSupabase as unknown as Parameters<typeof getMcpSessionToken>[0]);
    expect(res.token).toBeNull();
    expect(res.isExpired).toBe(true);
    expect(res.error).toBe('No hay sesión activa de Supabase');
  });

  it('genera un token personal no expirante y almacenable solo como hash', () => {
    const userId = 'b703cd3e-11f6-402e-81da-1db49f052b33';
    const generated = createMcpPersonalToken(userId);

    expect(generated.token).toMatch(/^mcp_pat_b703cd3e-11f6-402e-81da-1db49f052b33\.[A-Za-z0-9_-]{40,}$/);
    expect(generated.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.hash).not.toContain(generated.token);
    expect(parseMcpPersonalToken(generated.token)?.userId).toBe(userId);
    expect(verifyMcpPersonalTokenHash(generated.token, generated.hash)).toBe(true);
    expect(verifyMcpPersonalTokenHash(`${generated.token}alterado`, generated.hash)).toBe(false);
  });

  it('rechaza tokens personales mal formados', () => {
    expect(parseMcpPersonalToken('mcp_pat_sin-uuid.secreto')).toBeNull();
    expect(parseMcpPersonalToken('token-jwt-normal')).toBeNull();
  });

  it('intercambia una sesión vigente por un token MCP permanente', async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'jwt-bootstrap', expires_at: Math.floor(Date.now() / 1000) + 300 } },
          error: null,
        }),
      },
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'mcp_pat_55555555-5555-4555-8555-555555555555.secreto-largo-seguro-abcdefghijklmnopqrstuvwxyz',
        created_at: '2026-10-29T16:00:00.000Z',
        non_expiring: true,
      }),
    });

    const result = await getMcpPersonalToken(
      mockSupabase as unknown as Parameters<typeof getMcpPersonalToken>[0],
      fetcher as unknown as typeof fetch
    );

    expect(result.nonExpiring).toBe(true);
    expect(result.error).toBeNull();
    expect(fetcher).toHaveBeenCalledWith('/api/mcp/personal-token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-bootstrap' }),
    }));
  });
});
