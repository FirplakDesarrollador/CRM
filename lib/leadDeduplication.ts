export interface ExistingOpportunitySummary {
  id: string;
  nombre: string;
  comentarios?: string | null;
  owner_user_id?: string | null;
  created_at: string;
  estado_id: number;
}

export interface NewLeadInfo {
  fuente_conversion?: string;
  comentarios?: string;
  url_origen?: string;
  nombre_asesor?: string;
}

export const DEDUPLICATION_WINDOW_HOURS = 24;

/**
 * Evalúa si un lead entrante de la web debe ser considerado duplicado
 * de una oportunidad abierta existente creada dentro de la ventana de deduplicación.
 */
export function shouldDeduplicateLead(
  existingOp: ExistingOpportunitySummary | null | undefined,
  windowHours: number = DEDUPLICATION_WINDOW_HOURS,
  now: Date = new Date()
): boolean {
  if (!existingOp) return false;
  // Solo se deduplica contra oportunidades abiertas (1: Abierta, 8: Contacto Inicial)
  if (![1, 8].includes(existingOp.estado_id)) return false;

  const createdAt = new Date(existingOp.created_at).getTime();
  if (isNaN(createdAt)) return false;

  const windowMs = windowHours * 60 * 60 * 1000;
  const elapsed = now.getTime() - createdAt;
  return elapsed >= 0 && elapsed <= windowMs;
}

/**
 * Concatena la nueva interacción web al comentario de la oportunidad existente
 * preservando intacto el historial anterior y registrando la fecha/hora y origen.
 */
export function buildAppendedLeadComments(
  currentComments: string | null | undefined,
  lead: NewLeadInfo,
  timestampISO: string = new Date().toISOString()
): string {
  const parts: string[] = [];
  if (lead.fuente_conversion) parts.push(`[Re-contacto web: ${lead.fuente_conversion}]`);
  if (lead.comentarios) parts.push(lead.comentarios);
  if (lead.url_origen) parts.push(`URL: ${lead.url_origen}`);
  if (lead.nombre_asesor) parts.push(`Asesor solicitado: ${lead.nombre_asesor}`);

  const newInteraction = parts.join(" | ");
  if (!newInteraction) return currentComments || "";

  const header = `--- [INTERACCIÓN WEB ADICIONAL ${timestampISO}] ---`;
  if (!currentComments) {
    return `${header}\n${newInteraction}`;
  }
  return `${currentComments}\n\n${header}\n${newInteraction}`;
}
