#!/usr/bin/env node
/**
 * Entrypoint ejecutable CLI para el Servidor MCP CRM FIRPLAK (Transporte Stdio)
 * Compatible con Claude Desktop, Antigravity IDE, Cursor, Windsurf y Claude Code.
 */
import 'dotenv/config';
import { createCrmMcpServer } from '../lib/mcp/server';
import { McpUserRole } from '../lib/mcp/types';

async function main() {
  const email = process.env.CRM_USER_EMAIL || 'comercial@firplak.com';
  let role = (process.env.CRM_USER_ROLE || 'VENDEDOR').toUpperCase() as McpUserRole;
  let userId = process.env.CRM_USER_ID || '11111111-1111-1111-1111-111111111111';

  // Si Supabase está disponible, verificar y garantizar el rol real en CRM_Usuarios
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, serviceKey);
      const { data: crmUser } = await client
        .from('CRM_Usuarios')
        .select('id, email, role')
        .ilike('email', email)
        .single();

      if (crmUser?.role) {
        role = crmUser.role.toUpperCase() as McpUserRole;
      }
      if (crmUser?.id) {
        userId = crmUser.id;
      }
    } catch {
      // Mantener fallback de variables de entorno si la BD no responde
    }
  }

  const context = {
    userId,
    email,
    role,
    transport: 'stdio' as const,
  };

  process.stderr.write(`[CRM-MCP] Servidor MCP CRM FIRPLAK iniciado para ${email} (Rol: ${role})\n`);

  const server = createCrmMcpServer(context);
  await server.connectStdio();
}

main().catch((err) => {
  process.stderr.write(`[CRM-MCP Error Fatal]: ${err?.message || err}\n`);
  process.exit(1);
});
