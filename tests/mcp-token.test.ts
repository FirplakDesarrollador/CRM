import { describe, it, expect, vi } from 'vitest';
import { getMcpSessionToken, formatBearerAuthHeader, isTokenExpired } from '@/lib/mcp/token';

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

    const res = await getMcpSessionToken(mockSupabase as any);
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

    const res = await getMcpSessionToken(mockSupabase as any);
    expect(res.token).toBeNull();
    expect(res.isExpired).toBe(true);
    expect(res.error).toBe('No hay sesión activa de Supabase');
  });
});
