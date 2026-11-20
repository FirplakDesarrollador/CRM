#!/usr/bin/env node
/**
 * Wrapper de compatibilidad JS para invocar bin/crm-mcp.ts con tsx
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetScript = path.join(__dirname, 'crm-mcp.ts');

const child = spawn(process.execPath, ['--import', 'tsx', targetScript], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
