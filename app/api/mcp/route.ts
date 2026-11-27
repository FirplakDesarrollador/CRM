/**
 * Endpoint HTTP / SSE para el Servidor MCP de CRM FIRPLAK
 * Permite integraciones remotas (ChatGPT Custom Actions, Webhooks y Pasarelas de Agentes)
 *
 * Autenticación: token Bearer de Supabase verificado por firma (lib/mcp/auth.ts).
 * Sin sesión válida, POST responde 401 y GET retorna solo un manifiesto público
 * (estado y catálogo de herramientas) sin contexto de usuario.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createCrmMcpServer } from '@/lib/mcp/server';
import { McpSessionContext } from '@/lib/mcp/types';
import { resolveMcpSession } from '@/lib/mcp/auth';

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

async function resolveSessionFromRequest(req: NextRequest): Promise<McpSessionContext | null> {
  return resolveMcpSession({
    token: extractBearerToken(req),
    headers: req.headers,
  });
}

/** Contexto mínimo solo para listar el catálogo público en GET sin sesión. No ejecuta herramientas. */
const PUBLIC_MANIFEST_CONTEXT: McpSessionContext = {
  userId: 'anonimo',
  email: 'anonimo@firplak.com',
  role: 'VENDEDOR',
  transport: 'sse',
};

export async function GET(req: NextRequest) {
  const ctx = await resolveSessionFromRequest(req);
  const server = createCrmMcpServer(ctx ?? PUBLIC_MANIFEST_CONTEXT);

  const tools = await server.listTools();
  const resources = await server.listResources();

  return NextResponse.json({
    status: 'online',
    server: 'crm-firplak-mcp',
    version: '1.2.0',
    authenticated: Boolean(ctx),
    user_context: ctx
      ? {
          email: ctx.email,
          role: ctx.role,
        }
      : null,
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
    if (!ctx) {
      return NextResponse.json(
        {
          error:
            'No autorizado: se requiere un token Bearer válido de Supabase (Authorization: Bearer <access_token>). Genera el token desde Configuración > Integración MCP.',
        },
        { status: 401 }
      );
    }

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
