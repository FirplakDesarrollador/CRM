/**
 * Monto mínimo por categoría para leads / prospectos nuevos.
 *
 * Planner "Funcionalidades CRM B2C_2": "al ingresar los lead prospecto vengan
 * con monto mínimo por categoría".
 *
 * La tabla de montos vive en CRM_Configuracion (key = LEAD_MIN_AMOUNT_CONFIG_KEY,
 * value jsonb). Formato:
 *   {
 *     "modo": "maximo",            // "maximo" (por defecto) o "suma" si trae varias categorías
 *     "montos": { "Baños": 300000, "Cocinas": 5000000, ... }   // COP; null = sin mínimo
 *   }
 * También se acepta el objeto plano { "Baños": 300000, ... }.
 *
 * Este archivo no tiene dependencias para poder usarse desde la Edge Function
 * (Deno) y desde la app Next.js (lib/leadMinimumAmount.ts lo re-exporta).
 */

export const LEAD_MIN_AMOUNT_CONFIG_KEY = "lead_monto_minimo_por_categoria";

export type LeadMinimumMode = "maximo" | "suma";

export interface LeadMinimumAmountConfig {
  mode: LeadMinimumMode;
  /** clave normalizada de la categoría -> monto mínimo (> 0) */
  amounts: Map<string, number>;
}

/**
 * Nombres que llegan distinto según el origen (WordPress usa CRM_Categoria_Interes,
 * la app usa OPPORTUNITY_CATEGORIES). Todos apuntan a la misma clave.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  "hidromasajes/jacuzzis y tinas": "hidromasajes",
  "hidromasajes / jacuzzis y tinas": "hidromasajes",
  "jacuzzis y tinas": "hidromasajes",
  "jacuzzis": "hidromasajes",
  "zona de labores": "zona de labores",
  "carpinteria de obra": "carpinteria de obras",
};

export function normalizeLeadCategory(name: unknown): string {
  if (typeof name !== "string") return "";
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return CATEGORY_ALIASES[base] ?? base;
}

/** Separa "Baños, Cocinas" o ["Baños","Cocinas"] en categorías normalizadas, sin repetir. */
export function splitLeadCategories(value: unknown): string[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const out: string[] = [];
  for (const item of raw) {
    const key = normalizeLeadCategory(item);
    if (key && key !== "-" && !out.includes(key)) out.push(key);
  }
  return out;
}

function toPositiveNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lee el valor jsonb de CRM_Configuracion. Valores vacíos o inválidos se ignoran. */
export function parseLeadMinimumAmountConfig(value: unknown): LeadMinimumAmountConfig {
  let obj: unknown = value;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      obj = null;
    }
  }
  const amounts = new Map<string, number>();
  let mode: LeadMinimumMode = "maximo";
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    const montos = record.montos && typeof record.montos === "object" && !Array.isArray(record.montos)
      ? record.montos as Record<string, unknown>
      : record;
    if (typeof record.modo === "string" && record.modo.toLowerCase() === "suma") mode = "suma";
    for (const [name, amount] of Object.entries(montos)) {
      if (name === "modo" || name === "montos") continue;
      const key = normalizeLeadCategory(name);
      const n = toPositiveNumber(amount);
      if (key && n !== null) amounts.set(key, n);
    }
  }
  return { mode, amounts };
}

/**
 * Monto mínimo para las categorías del lead, o null si ninguna tiene mínimo.
 * Varias categorías: el mayor (modo "maximo") o la suma (modo "suma").
 */
export function resolveLeadMinimumAmount(
  categories: unknown,
  config: LeadMinimumAmountConfig | null | undefined,
): number | null {
  if (!config || config.amounts.size === 0) return null;
  const values = splitLeadCategories(categories)
    .map((c) => config.amounts.get(c))
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (values.length === 0) return null;
  return config.mode === "suma"
    ? values.reduce((a, b) => a + b, 0)
    : Math.max(...values);
}

/** Solo se aplica el mínimo si el lead llega sin monto (vacío o 0). */
export function shouldApplyLeadMinimum(amount: unknown): boolean {
  if (amount === null || amount === undefined || amount === "") return true;
  const n = Number(amount);
  return !Number.isFinite(n) || n <= 0;
}
