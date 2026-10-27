/**
 * Helpers para gestión y extracción de tokens de autenticación MCP
 */

export interface McpTokenSessionResult {
  token: string | null;
  expiresAt: number | null;
  formattedExpiresAt: string | null;
  isExpired: boolean;
  error: string | null;
}

export function formatBearerAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

export function isTokenExpired(expiresAt: number | null | undefined): boolean {
  if (!expiresAt) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return nowInSeconds >= expiresAt;
}

export async function getMcpSessionToken(supabaseClient: {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token?: string; expires_at?: number } | null };
      error: unknown;
    }>;
  };
}): Promise<McpTokenSessionResult> {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data?.session?.access_token) {
      return {
        token: null,
        expiresAt: null,
        formattedExpiresAt: null,
        isExpired: true,
        error: 'No hay sesión activa de Supabase',
      };
    }

    const session = data.session;
    const expiresAt = session.expires_at || null;
    let formattedExpiresAt: string | null = null;

    if (expiresAt) {
      const expDate = new Date(expiresAt * 1000);
      formattedExpiresAt = expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return {
      token: session.access_token,
      expiresAt,
      formattedExpiresAt,
      isExpired: isTokenExpired(expiresAt),
      error: null,
    };
  } catch (err: any) {
    return {
      token: null,
      expiresAt: null,
      formattedExpiresAt: null,
      isExpired: true,
      error: err?.message || 'Error al obtener sesión de Supabase',
    };
  }
}
