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
  const role = (process.env.CRM_USER_ROLE || 'VENDEDOR').toUpperCase() as McpUserRole;
  const userId = process.env.CRM_USER_ID || '11111111-1111-1111-1111-111111111111';

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
