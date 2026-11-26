const LEGACY_CORPORATE_DOMAINS = new Set(['behome.com', 'behome.com.co']);
const FALLBACK_ADVISOR_EMAIL = 'cartera@firplak.com';

/**
 * Correo que se imprime o se envía al cliente.
 * El login en CRM_Usuarios / auth.users puede seguir en @behome.com.co;
 * esa fila no se modifica aquí.
 */
export function toFirplakDisplayEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim();
  if (!value) return '';

  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return value;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (!LEGACY_CORPORATE_DOMAINS.has(domain)) return value;

  return `${local}@firplak.com`;
}

export function formatQuoteAdvisorEmailLine(email: string | null | undefined): string {
  const display = toFirplakDisplayEmail(email) || FALLBACK_ADVISOR_EMAIL;
  return `Email: ${display} • www.firplak.com`;
}
