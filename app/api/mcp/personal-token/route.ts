import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createMcpPersonalToken } from '@/lib/mcp/personal-token';

function bearerToken(req: NextRequest): string | null {
  const value = req.headers.get('authorization') || '';
  const token = value.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('El servidor MCP no tiene configuradas las credenciales de Supabase.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function authenticatedUser(req: NextRequest) {
  const accessToken = bearerToken(req);
  if (!accessToken || accessToken.startsWith('mcp_pat_')) return null;

  const client = serviceClient();
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { client, user: data.user };
}

export async function POST(req: NextRequest) {
  try {
    const authenticated = await authenticatedUser(req);
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Se requiere una sesión activa del CRM para generar el token permanente.' },
        { status: 401 }
      );
    }

    const { client, user } = authenticated;
    const generated = createMcpPersonalToken(user.id);
    const { error } = await client.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata || {}),
        mcp_personal_token_hash: generated.hash,
        mcp_personal_token_created_at: generated.createdAt,
        mcp_personal_token_version: 1,
      },
    });
    if (error) throw error;

    return NextResponse.json({
      token: generated.token,
      created_at: generated.createdAt,
      expires_at: null,
      non_expiring: true,
      previous_token_revoked: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el token MCP permanente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authenticated = await authenticatedUser(req);
    if (!authenticated) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { client, user } = authenticated;
    const { error } = await client.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata || {}),
        mcp_personal_token_hash: null,
        mcp_personal_token_revoked_at: new Date().toISOString(),
      },
    });
    if (error) throw error;
    return NextResponse.json({ revoked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo revocar el token MCP.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
