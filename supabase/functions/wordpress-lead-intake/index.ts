import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── CONFIGURACIÓN Y CONSTANTES ──────────────────────────────────────────────
const FALLBACK_OWNER_ID = "f361d4e5-d937-4668-913a-a4359658d6f4"; // Canal Propio
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
  // PASO 1: RESOLVER EL ASESOR (OWNER)
  // ────────────────────────────────────────────────────────────────────────────
  let ownerFinal = FALLBACK_OWNER_ID;
  let ownerResuelto = false;
  const nombreAsesor = (body.oportunidad?.asignado_a ?? "").trim();

  if (nombreAsesor) {
    const { data: user } = await supabase
      .from("CRM_Usuarios")
      .select("id")
      .ilike("full_name", `%${nombreAsesor}%`)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .limit(1)
      .maybeSingle();

    if (user) {
      ownerFinal = user.id;
      ownerResuelto = true;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASO 2: CUENTA (BUSCAR O CREAR)
  // ────────────────────────────────────────────────────────────────────────────
  let cuentaId = "";
  let existingCuenta: any = null;
  let nombreDeLaCuenta = "";

  // NUEVA LÓGICA: Buscar por teléfono del contacto
  const telefonoContacto = (body.contacto?.telefono ?? "").trim();
  
  // Evitar buscar si el teléfono es un simple guion o está vacío
  if (telefonoContacto && telefonoContacto !== "-") {
    // Buscar si existe una cuenta con el nit_base igual al telefono del contacto
    // o con el teléfono igual al teléfono del contacto
    const { data } = await supabase.from("CRM_Cuentas")
      .select("id, nombre")
      .or(`nit_base.eq.${telefonoContacto},telefono.eq.${telefonoContacto}`)
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
  } else {
    // NUEVA LÓGICA: Crear cuenta con datos del contacto
    // Si no manda nombre, por lo menos ponemos "Consumidor Final" en lugar de "-"
    let nombreContacto = (body.contacto?.nombre ?? "").trim();
    if (!nombreContacto || nombreContacto === "-") {
      nombreContacto = "Consumidor Final";
    }
    nombreDeLaCuenta = nombreContacto;

    const emailContacto = (body.contacto?.email ?? "").trim();
    
    const { data: newC, error: errC } = await supabase.from("CRM_Cuentas").insert({
      nombre: nombreContacto,
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
  await supabase.from("CRM_Contactos").insert({
    account_id: cuentaId,
    nombre: body.contacto?.nombre?.trim(),
    email: body.contacto?.email,
    telefono: body.contacto?.telefono
  });

  // ────────────────────────────────────────────────────────────────────────────
  // PASO 4: OPORTUNIDAD
  // ────────────────────────────────────────────────────────────────────────────
  let oportunidadNombre = body.oportunidad?.nombre?.trim();
  if (!oportunidadNombre || oportunidadNombre === "Por definir" || oportunidadNombre === "-") {
    oportunidadNombre = nombreDeLaCuenta;
  }

  const { data: op, error: errOp } = await supabase.from("CRM_Oportunidades").insert({
    account_id: cuentaId,
    owner_user_id: ownerFinal, // <--- Asignado a la oportunidad
    nombre: oportunidadNombre,
    categoria_oportunidad: body.oportunidad?.categoria_oportunidad,
    estado_id: ESTADO_ID,
    origen_oportunidad: body.oportunidad?.origen_oportunidad,
    url_origen: body.oportunidad?.url_origen,
    fuente_conversion: body.oportunidad?.fuente_conversion,
    comentarios: [
      body.oportunidad?.comentarios,
      !ownerResuelto && nombreAsesor ? `Asignado a: ${nombreAsesor} (No encontrado)` : null
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
