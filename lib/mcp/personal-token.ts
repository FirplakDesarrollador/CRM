import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const MCP_PERSONAL_TOKEN_PREFIX = 'mcp_pat_';
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PERSONAL_TOKEN_REGEX = new RegExp(
  `^${MCP_PERSONAL_TOKEN_PREFIX}(${UUID_PATTERN})\\.([A-Za-z0-9_-]{40,})$`,
  'i'
);

export interface McpPersonalToken {
  token: string;
  hash: string;
  userId: string;
  createdAt: string;
}

export function hashMcpPersonalToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createMcpPersonalToken(userId: string): McpPersonalToken {
  if (!new RegExp(`^${UUID_PATTERN}$`, 'i').test(userId)) {
    throw new Error('No se puede generar un token MCP para un identificador de usuario inválido.');
  }

  const secret = randomBytes(32).toString('base64url');
  const token = `${MCP_PERSONAL_TOKEN_PREFIX}${userId}.${secret}`;
  return {
    token,
    hash: hashMcpPersonalToken(token),
    userId,
    createdAt: new Date().toISOString(),
  };
}

export function parseMcpPersonalToken(token: string): { userId: string } | null {
  const match = PERSONAL_TOKEN_REGEX.exec(token);
  return match ? { userId: match[1].toLowerCase() } : null;
}

export function verifyMcpPersonalTokenHash(token: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashMcpPersonalToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
