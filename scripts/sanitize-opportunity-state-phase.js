require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = !process.argv.includes('--apply');
const ONLY_IDS = process.argv
  .filter(arg => arg.startsWith('--ids='))
  .flatMap(arg => arg.slice('--ids='.length).split(',').map(id => id.trim()).filter(Boolean));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. RLS may hide rows or block updates.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const normalize = value =>
  (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const canonicalStatusId = estadoId => {
  if (estadoId === 11) return 2;
  if (estadoId === 14) return 3;
  return estadoId || 1;
};

async function main() {
  const { data: phases, error: phaseError } = await supabase
    .from('CRM_FasesOportunidad')
    .select('id, nombre, canal_id, orden, probability, is_active')
    .eq('is_active', true);

  if (phaseError) throw phaseError;

  const closedPhaseByChannel = new Map();
  const firstOpenPhaseByChannel = new Map();

  for (const phase of phases || []) {
    const name = normalize(phase.nombre);
    const channel = phase.canal_id || 'UNKNOWN';
    const bucket = closedPhaseByChannel.get(channel) || {};

    if (name.includes('ganada')) {
      bucket.won = phase;
      closedPhaseByChannel.set(channel, bucket);
      continue;
    }

    if (name.includes('perdida')) {
      bucket.lost = phase;
      closedPhaseByChannel.set(channel, bucket);
      continue;
    }

    const current = firstOpenPhaseByChannel.get(channel);
    if (!current || Number(phase.orden || 0) < Number(current.orden || 0)) {
      firstOpenPhaseByChannel.set(channel, phase);
    }
  }

  let query = supabase
    .from('CRM_Oportunidades')
    .select(`
      id,
      nombre,
      estado_id,
      fase_id,
      probability,
      is_deleted,
      cuenta:CRM_Cuentas(canal_id),
      fase:CRM_FasesOportunidad(id, nombre, canal_id, probability)
    `)
    .eq('is_deleted', false);

  if (ONLY_IDS.length > 0) query = query.in('id', ONLY_IDS);

  const { data: opportunities, error: oppError } = await query;
  if (oppError) throw oppError;

  const changes = [];

  for (const opp of opportunities || []) {
    const currentStatus = canonicalStatusId(opp.estado_id);
    const phaseName = normalize(opp.fase?.nombre);
    const channel = opp.cuenta?.canal_id || opp.fase?.canal_id || 'UNKNOWN';
    const closed = closedPhaseByChannel.get(channel) || {};
    const patch = {};
    const reasons = [];

    if (phaseName.includes('ganada')) {
      if (currentStatus !== 2) {
        patch.estado_id = 2;
        reasons.push('fase ganada => estado Ganada');
      }
      if (opp.probability !== 100) patch.probability = 100;
    } else if (phaseName.includes('perdida')) {
      if (currentStatus !== 3) {
        patch.estado_id = 3;
        reasons.push('fase perdida => estado Perdida');
      }
      if (opp.probability !== 0) patch.probability = 0;
    } else if (currentStatus === 2 && closed.won) {
      patch.estado_id = 2;
      patch.fase_id = closed.won.id;
      patch.probability = closed.won.probability ?? 100;
      reasons.push('estado Ganada => fase cerrada ganada del canal');
    } else if (currentStatus === 3 && closed.lost) {
      patch.estado_id = 3;
      patch.fase_id = closed.lost.id;
      patch.probability = closed.lost.probability ?? 0;
      reasons.push('estado Perdida => fase cerrada perdida del canal');
    } else if ([11, 14].includes(opp.estado_id)) {
      patch.estado_id = currentStatus;
      reasons.push('normalizar estado legacy');
    }

    if ((currentStatus === 1 || currentStatus === 4) && (phaseName.includes('ganada') || phaseName.includes('perdida'))) {
      reasons.push('estado abierto/suspendido estaba en fase cerrada');
    }

    if (Object.keys(patch).length > 0) {
      changes.push({
        id: opp.id,
        nombre: opp.nombre,
        before: {
          estado_id: opp.estado_id,
          fase_id: opp.fase_id,
          fase: opp.fase?.nombre,
          probability: opp.probability,
          canal_id: channel
        },
        patch,
        reasons
      });
    }
  }

  console.log(JSON.stringify({
    mode: DRY_RUN ? 'dry-run' : 'apply',
    scanned: opportunities?.length || 0,
    changes: changes.length,
    rows: changes
  }, null, 2));

  if (DRY_RUN || changes.length === 0) return;

  for (const change of changes) {
    const { error } = await supabase
      .from('CRM_Oportunidades')
      .update({ ...change.patch, updated_at: new Date().toISOString() })
      .eq('id', change.id);

    if (error) {
      console.error(`Failed to update ${change.id}:`, error);
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
