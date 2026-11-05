export const LEAD_NAME_FALLBACK = 'Consumidor Final';

const PLACEHOLDERS = new Set(['', '-', 'por definir', 'consumidor final']);

export type LeadContactNameInput = {
  nombre?: string | null;
  nombres?: string | null;
  apellido?: string | null;
  apellidos?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function normalizeToken(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function isPlaceholderLeadName(value?: string | null): boolean {
  return PLACEHOLDERS.has(normalizeToken(value).toLowerCase());
}

function firstRealName(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!isPlaceholderLeadName(normalized)) return normalized;
  }
  return '';
}

export function resolveLeadPersonName(contacto?: LeadContactNameInput | null): string {
  const first = firstRealName([
    contacto?.nombre,
    contacto?.nombres,
    contacto?.firstname,
    contacto?.first_name,
  ]);
  const last = firstRealName([
    contacto?.apellido,
    contacto?.apellidos,
    contacto?.lastname,
    contacto?.last_name,
  ]);

  if (first && last) {
    const firstLower = first.toLowerCase();
    const lastLower = last.toLowerCase();
    if (firstLower.includes(lastLower)) return first;
    if (lastLower.includes(firstLower)) return last;
    return `${first} ${last}`;
  }

  return first || last || LEAD_NAME_FALLBACK;
}

export function resolveLeadOpportunityName(
  oportunidadNombre?: string | null,
  personName: string = LEAD_NAME_FALLBACK
): string {
  if (isPlaceholderLeadName(oportunidadNombre)) return personName;
  return normalizeToken(oportunidadNombre);
}
