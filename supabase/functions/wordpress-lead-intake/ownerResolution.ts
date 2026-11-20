// Resolución del asesor (owner) de un lead web.
// Regla vigente: el lead queda con el asesor que reporta WordPress/vTiger (MySQL).
// Única reasignación válida: comercial2@firplak.com (Katherine Villegas) -> Stiven Rua.
// Los alias son el MISMO asesor con otro correo en el CRM, no reasignaciones.

export const FALLBACK_OWNER_ID = "f361d4e5-d937-4668-913a-a4359658d6f4"; // canalpropio@firplak.com

export const REASIGNACIONES_VALIDAS: Record<string, string> = {
  "comercial2@firplak.com": "brian.rua@firplak.com", // Katherine Villegas -> Stiven Rua
};

export const ALIAS_CORREO_ASESOR: Record<string, string> = {
  "comercialcali@firplak.com": "comercialcali@behome.com.co", // Hernando Tovar
};

export type CrmUserLite = { id: string; email: string | null; is_active?: boolean | null; is_deleted?: boolean | null };

export function normalizeAdvisorEmail(raw?: string | null): string {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) return "";
  const reassigned = REASIGNACIONES_VALIDAS[email] ?? email;
  return ALIAS_CORREO_ASESOR[reassigned] ?? reassigned;
}

/** Devuelve el id del usuario CRM activo para el correo reportado por WordPress, o el fallback. */
export function resolveLeadOwnerId(rawEmail: string | null | undefined, users: CrmUserLite[]): string {
  const email = normalizeAdvisorEmail(rawEmail);
  if (!email) return FALLBACK_OWNER_ID;
  const match = users.find(
    (u) => (u.email ?? "").trim().toLowerCase() === email && u.is_active !== false && u.is_deleted !== true,
  );
  return match?.id ?? FALLBACK_OWNER_ID;
}
