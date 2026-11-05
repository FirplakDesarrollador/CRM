import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  isPlaceholderLeadName,
  resolveLeadOpportunityName,
  resolveLeadPersonName,
} from "./leadNaming.ts";
import { normalizeAdvisorEmail, resolveLeadOwnerId } from "./ownerResolution.ts";

// ─── CONFIGURACIÓN Y CONSTANTES ──────────────────────────────────────────────
const CANAL_ID          = "PROPIO";
const ESTADO_ID         = 8; // Contacto Inicial

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, x-firplak-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {

  // 1. Manejo de CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Validación de Seguridad
  const secret = req.headers.get("x-firplak-secret");
  if (!secret || secret !== Deno.env.get("WP_LEAD_SECRET")) {
    return new Response(JSON.stringify({ success: false, error: "No autorizado" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  // 3. Parsear el Body
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ────────────────────────────────────────────────────────────────────────────
  // PASO 1: RESOLVER EL ASESOR (OWNER) - BASADO EN CORREO DE WORDPRESS
  // ────────────────────────────────────────────────────────────────────────────
  // Se busca el correo en CRM_Usuarios (activo). Antes era un mapa fijo de 5 correos y
  // cualquier otro asesor (p. ej. Hernando Tovar, Gabriel Molina) caía en Canal Propio.
  const nombreAsesor = (body.oportunidad?.asignado_a ?? "").trim(); // se conserva en comentarios
  const correoAsesorWeb = normalizeAdvisorEmail(nombreAsesor);
  let usuariosAsesor: { id: string; email: string | null; is_active: boolean | null; is_deleted: boolean | null }[] = [];
  if (correoAsesorWeb) {
    const { data: usuarios } = await supabase.from("CRM_Usuarios")
      .select("id, email, is_active, is_deleted")
      .ilike("email", correoAsesorWeb)
      .limit(5);
    usuariosAsesor = usuarios ?? [];
  }
  const ownerFinal = resolveLeadOwnerId(nombreAsesor, usuariosAsesor);

  // ────────────────────────────────────────────────────────────────────────────
  // PASO 2: CUENTA (BUSCAR O CREAR)
  // ────────────────────────────────────────────────────────────────────────────
  let cuentaId = "";
  let existingCuenta: any = null;
  let nombreDeLaCuenta = "";
  const personName = resolveLeadPersonName(body.contacto);
  const hasRealPersonName = !isPlaceholderLeadName(personName);

  const telefonoContacto = (body.contacto?.telefono ?? "").trim();
  const emailContacto = (body.contacto?.email ?? "").trim();
  
  let queryConditions = [];
  if (telefonoContacto && telefonoContacto !== "-") {
    queryConditions.push(`nit_base.eq.${telefonoContacto}`);
    queryConditions.push(`telefono.eq.${telefonoContacto}`);
  }
  if (emailContacto && emailContacto !== "-") {
    queryConditions.push(`email.eq.${emailContacto}`);
  }

  // Buscar si existe una cuenta
  if (queryConditions.length > 0) {
    const { data } = await supabase.from("CRM_Cuentas")
      .select("id, nombre")
      .or(queryConditions.join(","))
      .eq("is_deleted", false)
      .limit(1)
      .maybeSingle();
      
    existingCuenta = data;
  }

  if (existingCuenta) {
    cuentaId = existingCuenta.id;
    nombreDeLaCuenta = existingCuenta.nombre;
    // IMPORTANTE: Ya no cambiamos el dueño de la cuenta existente, 
    // evitamos el problema de estar saltando la propiedad a cada asesor nuevo.
    if (hasRealPersonName && isPlaceholderLeadName(existingCuenta.nombre)) {
      nombreDeLaCuenta = personName;
      const nowIso = new Date().toISOString();
      await supabase.from("CRM_Cuentas").update({
        nombre: personName,
        updated_at: nowIso
      }).eq("id", cuentaId);
      await supabase.from("CRM_Contactos").update({
        nombre: personName,
        updated_at: nowIso
      }).eq("account_id", cuentaId).in("nombre", ["Consumidor Final", "Por definir", "-", ""]);
    }
  } else {
    // Crear cuenta con nombre real del contacto (firstname+lastname de WP/vTiger).
    nombreDeLaCuenta = personName;

    const { data: newC, error: errC } = await supabase.from("CRM_Cuentas").insert({
      nombre: personName,
      nit_base: telefonoContacto && telefonoContacto !== "-" ? telefonoContacto : null,
      email: emailContacto && emailContacto !== "-" ? emailContacto : null,
      telefono: telefonoContacto && telefonoContacto !== "-" ? telefonoContacto : null,
      canal_id: CANAL_ID,
      owner_user_id: ownerFinal
    }).select("id").single();
    
    if (errC) throw new Error("Error al crear cuenta: " + errC.message);
    cuentaId = newC.id;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASO 3: CONTACTO
  // ────────────────────────────────────────────────────────────────────────────
  // Solo insertamos el contacto si no existe uno en esa misma cuenta con ese correo o teléfono
  let contactExists = false;
  if (existingCuenta && queryConditions.length > 0) {
    const { data: extContact } = await supabase.from("CRM_Contactos")
      .select("id")
      .eq("account_id", cuentaId)
      .or(queryConditions.join(","))
      .limit(1)
      .maybeSingle();
    if (extContact) contactExists = true;
  }

  if (!contactExists) {
    await supabase.from("CRM_Contactos").insert({
      account_id: cuentaId,
      nombre: personName,
      email: body.contacto?.email,
      telefono: body.contacto?.telefono
    });
  } else if (hasRealPersonName) {
    await supabase.from("CRM_Contactos").update({
      nombre: personName,
      updated_at: new Date().toISOString()
    }).eq("account_id", cuentaId).in("nombre", ["Consumidor Final", "Por definir", "-", ""]);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASO 4: OPORTUNIDAD (DEDUPLICACIÓN INTELIGENTE)
  // ────────────────────────────────────────────────────────────────────────────
  // Si la cuenta ya tiene una oportunidad abierta reciente (últimas 24 horas),
  // evitamos crear una duplicada y anexamos la interacción web en comentarios.
  const window24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let existingOp: any = null;

  if (cuentaId) {
    const { data: openOp } = await supabase.from("CRM_Oportunidades")
      .select("id, nombre, comentarios, owner_user_id, created_at")
      .eq("account_id", cuentaId)
      .in("estado_id", [1, 8]) // 1: Abierta, 8: Contacto Inicial
      .eq("is_deleted", false)
      .gte("created_at", window24h)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    existingOp = openOp;
  }

  if (existingOp) {
    // Lead duplicado detectado: anexar comentarios e interacción a la oportunidad abierta
    const parts = [
      body.oportunidad?.fuente_conversion ? `[Re-contacto web: ${body.oportunidad.fuente_conversion}]` : null,
      body.oportunidad?.comentarios ? body.oportunidad.comentarios : null,
      body.oportunidad?.url_origen ? `URL: ${body.oportunidad.url_origen}` : null,
      nombreAsesor ? `Asesor solicitado: ${nombreAsesor}` : null
    ].filter(Boolean);

    const shouldFixPlaceholderName = hasRealPersonName && isPlaceholderLeadName(existingOp.nombre);
    if (parts.length > 0 || shouldFixPlaceholderName) {
      const fechaColombia = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
      const oppPatch: Record<string, string> = {
        updated_at: new Date().toISOString()
      };
      if (parts.length > 0) {
        const nuevoBloque = `--- [INTERACCIÓN WEB ADICIONAL ${fechaColombia}] ---\n${parts.join(" | ")}`;
        oppPatch.comentarios = existingOp.comentarios
          ? `${existingOp.comentarios}\n\n${nuevoBloque}`
          : nuevoBloque;
      }
      if (shouldFixPlaceholderName) {
        oppPatch.nombre = personName;
      }
      await supabase.from("CRM_Oportunidades").update(oppPatch).eq("id", existingOp.id);
    }

    return new Response(JSON.stringify({
      success: true,
      cuenta_id: cuentaId,
      oportunidad_id: existingOp.id,
      asesor_asignado_id: existingOp.owner_user_id,
      confirmacion_db: existingOp.owner_user_id,
      duplicado_prevenido: true
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  // Si no existe oportunidad abierta reciente, crear la oportunidad normalmente
  const oportunidadNombre = resolveLeadOpportunityName(body.oportunidad?.nombre, nombreDeLaCuenta);

  const { data: op, error: errOp } = await supabase.from("CRM_Oportunidades").insert({
    account_id: cuentaId,
    owner_user_id: ownerFinal, // <--- Asignado a la oportunidad
    nombre: oportunidadNombre,
    categoria_oportunidad: Array.isArray(body.oportunidad?.categoria_oportunidad)
      ? body.oportunidad.categoria_oportunidad.join(", ")
      : body.oportunidad?.categoria_oportunidad,
    estado_id: ESTADO_ID,
    origen_oportunidad: body.oportunidad?.origen_oportunidad,
    url_origen: body.oportunidad?.url_origen,
    fuente_conversion: body.oportunidad?.fuente_conversion,
    comentarios: [
      body.oportunidad?.comentarios,
      nombreAsesor ? `Asesor solicitado desde web: ${nombreAsesor}` : null
    ].filter(Boolean).join("\n")
  }).select("id, owner_user_id").single();

  if (errOp) throw new Error("Error al crear oportunidad: " + errOp.message);

  // 5. Respuesta con verificación
  return new Response(JSON.stringify({
    success: true,
    cuenta_id: cuentaId,
    oportunidad_id: op.id,
    asesor_asignado_id: ownerFinal,
    confirmacion_db: op.owner_user_id
  }), { 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });
});
