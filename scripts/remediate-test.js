const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lnphhmowklqiomownurw.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIwMzQwMjUsImV4cCI6MjAwNzYxMDAyNX0.FHCOWrVp-K-7qrM3CtYmYaqiOqwzsX_Au7pLm-MN3eQ';

const supabase = createClient(supabaseUrl, supabaseKey);
const GHOST_ACCOUNT_ID = '163aa17b-8c5d-43a5-bc1c-1e364d394866';

async function runMigration() {
  console.log('--- INICIANDO PRUEBA DE MIGRACIÓN (5 REGISTROS) ---');

  // 1. Obtener 5 oportunidades de la cuenta fantasma
  const { data: opps, error: oppsError } = await supabase
    .from('CRM_Oportunidades')
    .select('id, created_at, owner_user_id')
    .eq('account_id', GHOST_ACCOUNT_ID)
    .order('created_at', { ascending: true })
    .limit(5);

  if (oppsError || !opps || opps.length === 0) {
    console.error('Error obteniendo oportunidades o no hay registros:', oppsError);
    return;
  }

  console.log(`Se encontraron ${opps.length} oportunidades para migrar.`);

  let successCount = 0;

  for (const opp of opps) {
    // 2. Buscar contacto asociado (creado al mismo tiempo ± 2 segundos)
    const oppDate = new Date(opp.created_at);
    const startDate = new Date(oppDate.getTime() - 2000).toISOString();
    const endDate = new Date(oppDate.getTime() + 2000).toISOString();

    const { data: contacts, error: contactError } = await supabase
      .from('CRM_Contactos')
      .select('*')
      .eq('account_id', GHOST_ACCOUNT_ID)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .limit(1);

    if (contactError || !contacts || contacts.length === 0) {
      console.warn(`No se encontró contacto para la oportunidad ${opp.id} (creada en ${opp.created_at})`);
      continue;
    }

    const contact = contacts[0];
    console.log(`\nProcesando Oportunidad ${opp.id} -> Contacto: ${contact.nombre} (${contact.telefono})`);

    // 3. Crear nueva cuenta
    const nombreContacto = contact.nombre ? contact.nombre.trim() : '';
    const telefonoContacto = contact.telefono ? contact.telefono.trim() : '';
    
    // Generamos un uuid temporal si no tiene telefono para el nit
    const pseudoNit = telefonoContacto || `TEMP-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const { data: newAccount, error: accError } = await supabase
      .from('CRM_Cuentas')
      .insert({
        nombre: nombreContacto && nombreContacto !== '-' ? nombreContacto : 'Consumidor Final',
        nit_base: pseudoNit,
        email: contact.email || null,
        telefono: telefonoContacto || null,
        canal_id: 'PROPIO',
        owner_user_id: opp.owner_user_id
      })
      .select('id')
      .single();

    if (accError || !newAccount) {
      console.error(`Error creando cuenta para contacto ${contact.nombre}:`, accError);
      // It might fail because of RLS. Let's see.
      continue;
    }

    console.log(`  ✓ Nueva cuenta creada: ${newAccount.id}`);

    // 4. Actualizar Contacto
    const { error: updateContactError } = await supabase
      .from('CRM_Contactos')
      .update({ account_id: newAccount.id })
      .eq('id', contact.id);

    if (updateContactError) {
      console.error('  Error actualizando contacto:', updateContactError);
      continue;
    }

    // 5. Actualizar Oportunidad
    const { error: updateOppError } = await supabase
      .from('CRM_Oportunidades')
      .update({ account_id: newAccount.id })
      .eq('id', opp.id);

    if (updateOppError) {
      console.error('  Error actualizando oportunidad:', updateOppError);
      continue;
    }

    console.log(`  ✓ Contacto y Oportunidad movidos exitosamente.`);
    successCount++;
  }

  console.log(`\n--- PRUEBA FINALIZADA. Migrados exitosamente: ${successCount}/5 ---`);
}

runMigration().catch(console.error);
