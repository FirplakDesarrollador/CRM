// crm-export-api — API de SOLO LECTURA para exportar Contactos y Oportunidades del CRM
// (consumida por Dimarka para reportes de Looker Studio y pruebas internas).
//
// Seguridad:
//  - verify_jwt = false; autenticación propia con API key en `x-api-key`, `apikey`
//    o `Authorization: Bearer <key>` (también acepta credenciales del proyecto Supabase).
//  - Claves válidas (cualquiera de estas fuentes, permite rotación):
//      * secret DIMARKA_API_KEY            -> claves en texto, separadas por coma
//      * secret DIMARKA_API_KEY_SHA256     -> hashes SHA-256 (hex), separados por coma
//      * EMBEDDED_KEY_SHA256 (abajo)       -> hashes SHA-256 (hex) autorizados
//      * SUPABASE_ANON_KEY / SERVICE_ROLE  -> claves del entorno Supabase para pruebas
//  - Comparación en tiempo constante sobre el hash SHA-256. La clave nunca se registra.
//  - Solo GET/OPTIONS. Solo lee CRM_Contactos y CRM_Oportunidades (+ nombres de tablas
//    de referencia). No escribe nada.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Hashes SHA-256 de claves autorizadas
const EMBEDDED_KEY_SHA256: string[] = [
  "0445936f518c1641f82dd0d7fd348ea9460b25cdd11f6a3586ef77a97742e9b9", // Dimarka #1 (2026-10-27)
  "80623e7ecb4fa5b6e77fbc2b890bb643eb7d3b4232f3cdd544c4a79c8f38e440", // prueba-postman-grok (2026-11-03)
  "1f3f25007df09404f4fb2e97b5ee0937330c894d6f85d5e8701315dddf65ab32", // firplak_export_2026_k8m2p9v4x7q1w5z3 (2026-11-08, clave oficial Postman)
  "7dd725b90b2183cd9a7a65363f43fca5295170e3a16eef75c22543f18e648e93", // sb_publishable_wQEkVxPh82rADqsW75bycg_mS8fBjSy (Supabase Publishable Key)
];

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const PAGE_CHUNK = 1000; // PostgREST devuelve máx. 1000 filas por llamada
const RATE_LIMIT_PER_MIN = 60;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Resource = {
  table: string;
  select: string;
  columns: string[]; // columnas crudas (todas las de la tabla)
  extra: Record<string, (r: any) => unknown>; // columnas legibles adicionales
};

const RESOURCES: Record<string, Resource> = {
  contactos: {
    table: "CRM_Contactos",
    select: "*, _cuenta:CRM_Cuentas!fk_crmcontactos_account(nombre, nit_base)",
    columns: [
      "id", "account_id", "nombre", "cargo", "email", "telefono", "es_principal",
      "created_at", "updated_at", "created_by", "updated_by", "is_deleted",
      "_sync_metadata", "comentarios",
    ],
    extra: {
      cuenta_nombre: (r: any) => r._cuenta?.nombre ?? null,
      cuenta_nit: (r: any) => r._cuenta?.nit_base ?? null,
    },
  },
  oportunidades: {
    table: "CRM_Oportunidades",
    select: [
      "*",
      "_cuenta:CRM_Cuentas!fk_crmopp_account(nombre, nit_base)",
      "_asesor:CRM_Usuarios!fk_crmopp_owner(full_name, email)",
      "_fase:CRM_FasesOportunidad!fk_crmopp_fase(nombre)",
      "_estado:CRM_EstadosOportunidad!fk_crmopp_estado(nombre)",
      "_segmento:CRM_Segmentos!fk_crmoportunidades_segmento(nombre)",
      "_ciudad:CRM_Ciudades!CRM_Oportunidades_ciudad_id_fkey(nombre)",
      "_departamento:CRM_Departamentos!CRM_Oportunidades_departamento_id_fkey(nombre)",
      "_pais:CRM_Paises!CRM_Oportunidades_pais_id_fkey(nombre)",
      "_razon:CRM_RazonesPerdida!CRM_Oportunidades_razon_perdida_id_fkey(descripcion)",
    ].join(", "),
    columns: [
      "id", "account_id", "owner_user_id", "nombre", "amount", "currency_id", "estado_id",
      "fase_id", "fecha_cierre_estimada", "probabilidad", "sap_doc_entry", "sap_order_id",
      "created_at", "updated_at", "created_by", "updated_by", "is_deleted", "_sync_metadata",
      "items", "segmento_id", "departamento_id", "ciudad_id", "probability", "razon_perdida_id",
      "origen_oportunidad", "url_origen", "fuente_conversion", "pais_id", "razon_perdida",
      "comentarios_perdida", "comentarios", "direccion_entrega", "categoria_oportunidad",
      "contactos_ids", "clientes_atendidos", "fecha_entrega", "setter",
    ],
    extra: {
      cuenta_nombre: (r: any) => r._cuenta?.nombre ?? null,
      cuenta_nit: (r: any) => r._cuenta?.nit_base ?? null,
      asesor_nombre: (r: any) => r._asesor?.full_name ?? null,
      asesor_email: (r: any) => r._asesor?.email ?? null,
      fase_nombre: (r: any) => r._fase?.nombre ?? null,
      estado_nombre: (r: any) => r._estado?.nombre ?? null,
      segmento_nombre: (r: any) => r._segmento?.nombre ?? null,
      ciudad_nombre: (r: any) => r._ciudad?.nombre ?? null,
      departamento_nombre: (r: any) => r._departamento?.nombre ?? null,
      pais_nombre: (r: any) => r._pais?.nombre ?? null,
      razon_perdida_descripcion: (r: any) => r._razon?.descripcion ?? null,
    },
  },
};

// ─── utilidades ──────────────────────────────────────────────────────────────
const enc = new TextEncoder();

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

let cachedHashes: string[] | null = null;
async function allowedHashes(): Promise<string[]> {
  if (cachedHashes) return cachedHashes;
  const split = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const fromPlain = await Promise.all(split(Deno.env.get("DIMARKA_API_KEY")).map(sha256Hex));
  const fromHash = split(Deno.env.get("DIMARKA_API_KEY_SHA256")).map((h) => h.toLowerCase());
  cachedHashes = [...fromPlain, ...fromHash, ...EMBEDDED_KEY_SHA256.map((h) => h.toLowerCase())];
  return cachedHashes;
}

// Limpia errores típicos al pegar la clave (Postman, Looker, Apps Script)
function cleanKey(v: string | null | undefined): string | null {
  if (!v) return null;
  let k = v.replace(/[\r\n\t]/g, "").trim();
  for (let i = 0; i < 3; i++) {
    const before = k;
    k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
    k = k.replace(/^(bearer|x-api-key|apikey|api[_-]?key)\s*[:=]?\s+/i, "").trim();
    if (k === before) break;
  }
  return k || null;
}

function extractKey(req: Request): { key: string | null; via: string } {
  const x = cleanKey(req.headers.get("x-api-key"));
  if (x) return { key: x, via: "x-api-key" };
  const apikey = cleanKey(req.headers.get("apikey"));
  if (apikey) return { key: apikey, via: "apikey" };
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^\s*Bearer\s+(.+)$/is);
  if (m) return { key: cleanKey(m[1]), via: "bearer" };
  const q = new URL(req.url).searchParams.get("api_key");
  if (q) return { key: cleanKey(q), via: "query(api_key)" };
  return { key: null, via: auth ? "authorization-sin-bearer" : "ninguno" };
}

async function isAuthorized(key: string | null): Promise<{ ok: boolean; keyId: string; reason?: string }> {
  if (!key) return { ok: false, keyId: "-", reason: "sin_clave" };
  if (key.length < 20 || key.length > 1024) return { ok: false, keyId: "-", reason: `largo_invalido(${key.length})` };

  // 1. Permitir tokens del entorno Supabase (anon key o service_role)
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if ((anonKey && key === anonKey) || (serviceKey && key === serviceKey)) {
    return { ok: true, keyId: "supa-env" };
  }

  // 2. Comparación contra hashes autorizados
  const h = await sha256Hex(key);
  let ok = false;
  for (const a of await allowedHashes()) {
    if (timingSafeEqual(h, a)) ok = true;
  }
  return { ok, keyId: h.slice(0, 8), reason: ok ? undefined : "clave_no_registrada" };
}

const hits = new Map<string, number[]>();
function rateLimited(id: string): boolean {
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(id, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_LIMIT_PER_MIN;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseDate(v: string | null): string | null | "invalid" {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "-";
}

// ─── handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const started = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Método no permitido. Use GET." }, 405, { Allow: "GET, OPTIONS" });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("crm-export-api");
  const resourceName = (idx >= 0 ? parts[idx + 1] : parts[parts.length - 1] === "crm-export-api" ? undefined : parts[parts.length - 1])?.toLowerCase();
  const ip = clientIp(req);

  const { key: presented, via } = extractKey(req);
  const { ok, keyId, reason } = await isAuthorized(presented);
  if (!ok) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "unauthorized", reason, via, key: keyId, len: presented?.length ?? 0, path: url.pathname, ip }));
    return json({
      error: "No autorizado. Envíe la API key entregada por Firplak en el header 'x-api-key: <clave>', 'apikey: <clave>' o 'Authorization: Bearer <clave>'.",
      motivo: reason,
    }, 401, { "WWW-Authenticate": "Bearer" });
  }
  if (rateLimited(`${keyId}:${ip}`)) {
    return json({ error: `Demasiadas solicitudes (máx. ${RATE_LIMIT_PER_MIN}/min).` }, 429, { "Retry-After": "60" });
  }

  // Índice / health
  if (!resourceName) {
    return json({
      api: "crm-export-api",
      version: "1.2.0",
      status: "ok",
      resources: Object.fromEntries(Object.entries(RESOURCES).map(([name, r]) => [name, {
        path: `/crm-export-api/${name}`,
        fields: [...r.columns, ...Object.keys(r.extra)],
      }])),
      params: ["limit (1-5000, def 1000)", "offset", "updated_since", "created_since", "include_deleted", "order (created_at|updated_at)", "format (json|csv)"],
    });
  }

  const res = RESOURCES[resourceName];
  if (!res) return json({ error: `Recurso no encontrado: ${resourceName}`, available: Object.keys(RESOURCES) }, 404);

  const q = url.searchParams;
  const limitRaw = parseInt(q.get("limit") ?? `${DEFAULT_LIMIT}`, 10);
  const offsetRaw = parseInt(q.get("offset") ?? "0", 10);
  if (isNaN(limitRaw) || limitRaw < 1 || isNaN(offsetRaw) || offsetRaw < 0) {
    return json({ error: "limit/offset inválidos" }, 400);
  }
  const limit = Math.min(limitRaw, MAX_LIMIT);
  const offset = offsetRaw;
  const updatedSince = parseDate(q.get("updated_since"));
  const createdSince = parseDate(q.get("created_since"));
  if (updatedSince === "invalid" || createdSince === "invalid") {
    return json({ error: "updated_since / created_since deben ser fechas ISO (ej. 2026-01-01 o 2026-01-01T00:00:00Z)" }, 400);
  }
  const includeDeleted = (q.get("include_deleted") ?? "").toLowerCase() === "true";
  const order = q.get("order") === "updated_at" ? "updated_at" : "created_at";
  const format = (q.get("format") ?? "json").toLowerCase() === "csv" ? "csv" : "json";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows: any[] = [];
  let total: number | null = null;
  for (let from = offset; from < offset + limit; from += PAGE_CHUNK) {
    const to = Math.min(from + PAGE_CHUNK, offset + limit) - 1;
    let query = supabase.from(res.table).select(res.select, { count: from === offset ? "exact" : undefined });
    if (!includeDeleted) query = query.or("is_deleted.is.null,is_deleted.eq.false");
    if (updatedSince) query = query.gte("updated_at", updatedSince);
    if (createdSince) query = query.gte("created_at", createdSince);
    query = query.order(order, { ascending: true, nullsFirst: true }).order("id", { ascending: true }).range(from, to);
    const { data, error, count } = await query;
    if (error && error.code === "PGRST103") break;
    if (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), event: "db_error", resource: resourceName, code: error.code, msg: error.message }));
      return json({ error: "Error consultando la base de datos" }, 500);
    }
    if (from === offset) total = count ?? null;
    rows.push(...(data ?? []));
    if (!data || data.length < to - from + 1) break;
  }

  if (total === null) {
    let cq = supabase.from(res.table).select("id", { count: "exact", head: true });
    if (!includeDeleted) cq = cq.or("is_deleted.is.null,is_deleted.eq.false");
    if (updatedSince) cq = cq.gte("updated_at", updatedSince);
    if (createdSince) cq = cq.gte("created_at", createdSince);
    const { count } = await cq;
    total = count ?? null;
  }

  const fields = [...res.columns, ...Object.keys(res.extra)];
  const out = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of res.columns) o[c] = r[c] ?? null;
    for (const [k, fn] of Object.entries(res.extra)) o[k] = fn(r);
    return o;
  });

  const nextOffset = offset + out.length;
  const hasMore = total !== null ? nextOffset < total : out.length === limit;
  let next: string | null = null;
  if (hasMore) {
    const nu = new URL(req.url);
    nu.searchParams.set("offset", String(nextOffset));
    nu.searchParams.set("limit", String(limit));
    const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
    const path = nu.pathname.startsWith("/functions/v1") ? nu.pathname : `/functions/v1${nu.pathname}`;
    next = `${base}${path}${nu.search}`;
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(), event: "export", resource: resourceName, rows: out.length,
    offset, limit, format, ip, key: keyId, ms: Date.now() - started,
  }));

  if (format === "csv") {
    const lines = [fields.join(",")];
    for (const o of out) lines.push(fields.map((f) => csvCell(o[f])).join(","));
    const bom = (q.get("bom") ?? "true").toLowerCase() === "false" ? "" : "\uFEFF";
    return new Response(bom + lines.join("\r\n") + "\r\n", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="${resourceName}.csv"`,
        "Cache-Control": "no-store",
        "X-Total-Count": String(total ?? ""),
        "X-Next-Offset": hasMore ? String(nextOffset) : "",
      },
    });
  }

  return json({ data: out, count: total, limit, offset, next, fields });
});
