/**
 * Endpoint HTTP / SSE para el Servidor MCP de CRM FIRPLAK
 * Permite integraciones remotas (ChatGPT Custom Actions, Webhooks y Pasarelas de Agentes)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createCrmMcpServer } from '@/lib/mcp/server';
import { McpSessionContext, McpUserRole } from '@/lib/mcp/types';
import { createClient } from '@supabase/supabase-js';

async function resolveSessionFromRequest(req: NextRequest): Promise<McpSessionContext> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (token && supabaseUrl && (serviceKey || anonKey)) {
    try {
      const client = createClient(supabaseUrl, serviceKey || anonKey!);
      const { data: { user }, error } = await client.auth.getUser(token);

      if (user && !error) {
        // Consultar rol en CRM_Usuarios
        const { data: crmUser } = await client
          .from('CRM_Usuarios')
          .select('id, email, rol')
          .eq('id', user.id)
          .single();

        const role: McpUserRole = (crmUser?.rol || user.app_metadata?.role || 'VENDEDOR').toUpperCase();

        return {
          userId: user.id,
          email: user.email || 'comercial@firplak.com',
          role,
          transport: 'sse',
        };
      }
    } catch (e) {
      console.warn('[MCP-API] No se pudo verificar token JWT:', e);
    }
  }

  // Fallback para pruebas o llamadas con clave de servicio
  const defaultEmail = req.headers.get('x-user-email') || process.env.CRM_USER_EMAIL || 'vendedor@firplak.com';
  const defaultRole = (req.headers.get('x-user-role') || process.env.CRM_USER_ROLE || 'VENDEDOR').toUpperCase() as McpUserRole;
  const defaultId = req.headers.get('x-user-id') || '11111111-1111-1111-1111-111111111111';

  return {
    userId: defaultId,
    email: defaultEmail,
    role: defaultRole,
    transport: 'sse',
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveSessionFromRequest(req);
  const server = createCrmMcpServer(ctx);

  const tools = await server.listTools();
  const resources = await server.listResources();

  return NextResponse.json({
    status: 'online',
    server: 'crm-firplak-mcp',
    version: '1.2.0',
    user_context: {
      email: ctx.email,
      role: ctx.role,
    },
    capabilities: {
      tools_count: tools.length,
      resources_count: resources.length,
    },
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    resources: resources.map((r) => ({
      uri: r.uri,
      name: r.name,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveSessionFromRequest(req);
    const server = createCrmMcpServer(ctx);
    const body = await req.json();

    // Soporte para protocolo JSON-RPC 2.0
    if (body.jsonrpc === '2.0') {
      const { id, method, params } = body;

      if (method === 'tools/list') {
        const tools = await server.listTools();
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: { tools },
        });
      }

      if (method === 'resources/list') {
        const resources = await server.listResources();
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: { resources },
        });
      }

      if (method === 'resources/read') {
        const res = await server.readResource(params?.uri);
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: res,
        });
      }

      if (method === 'tools/call') {
        const result = await server.callTool(params?.name, params?.arguments || {});
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result,
        });
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Método '${method}' no soportado.` },
      });
    }

    // Soporte para invocación directa REST: { tool: "nombre", args: { ... } }
    if (body.tool) {
      const result = await server.callTool(body.tool, body.args || {});
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Petición inválida. Se esperaba payload JSON-RPC 2.0 o { tool, args }' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor MCP';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
