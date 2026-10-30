/**
 * Carga "justo a tiempo" (JIT) desde Supabase hacia la copia local (Dexie).
 *
 * La sincronización inicial solo trae las 3.000 actividades/oportunidades más recientes,
 * así que lo más antiguo (p. ej. lo migrado de vTiger) no existe en el navegador y las
 * vistas que leen la copia local no lo muestran. Estas funciones traen del servidor lo
 * que se necesita para una oportunidad o una búsqueda y lo guardan localmente.
 *
 * Reglas de seguridad:
 * - Solo inserta registros que NO existen localmente (no pisa datos locales; el sync
 *   incremental mantiene actualizados los que ya existen).
 * - Nunca toca registros con cambios pendientes en el outbox (p. ej. una actividad borrada
 *   offline que aún no se ha subido no "revive").
 * - No escribe nada en Supabase: solo lecturas.
 * - Asesor (VENDEDOR): solo trae actividades asignadas a él (misma regla de sellerVisibility).
 */
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { isSellerRole } from '@/lib/sellerVisibility';
import { getSearchTokens, accentInsensitiveCondition, applyAccentInsensitiveFilter } from '@/lib/utils';
import { getCellphoneSearchDigits } from '@/lib/phoneSearch';

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;
const MAX_SEARCH_MATCHES = 100;
const MAX_SEARCH_ACTIVITIES = 2000;
const MAX_OPPORTUNITY_ACTIVITIES = 5000;
const MAX_OWN_ACTIVITIES = 30000;
const OWN_HISTORY_MONTHS = 12;

type Viewer = { viewerId?: string | null; viewerRole?: string | null };
type Row = { id: string; [key: string]: unknown };

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

const chunk = <T,>(items: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
};

async function fetchPaged(
    build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
    max: number
): Promise<Row[]> {
    const rows: Row[] = [];
    for (let from = 0; from < max; from += PAGE_SIZE) {
        const to = Math.min(from + PAGE_SIZE, max) - 1;
        const { data, error } = await build(from, to);
        if (error) throw error;
        const page = (data || []) as Row[];
        rows.push(...page);
        if (page.length < to - from + 1) break;
    }
    return rows;
}

async function pendingEntityIds(entityType: string): Promise<Set<string>> {
    const items = await db.outbox
        .where('entity_type').equals(entityType)
        .and(item => item.status !== 'COMPLETED')
        .toArray();
    return new Set(items.map(item => item.entity_id));
}

/** Inserta en Dexie solo las filas que no existen localmente y no tienen cambios pendientes. */
async function addMissing(
    table: 'activities' | 'opportunities' | 'accounts',
    entityType: string,
    rows: Row[]
): Promise<number> {
    if (rows.length === 0) return 0;
    const unique = Array.from(new Map(rows.filter(r => r && r.id).map(r => [r.id, r])).values());
    const dexieTable = db[table] as unknown as {
        bulkGet: (ids: string[]) => Promise<(unknown | undefined)[]>;
        bulkAdd: (items: unknown[]) => Promise<unknown>;
    };
    const existing = await dexieTable.bulkGet(unique.map(r => r.id));
    const pending = await pendingEntityIds(entityType);
    const missing = unique.filter((r, i) => !existing[i] && !pending.has(r.id));
    if (missing.length === 0) return 0;

    // Son datos del servidor (no creaciones del usuario): no registrarlos en el historial local.
    const alreadyPulling = db.isPulling;
    db.isPulling = true;
    try {
        await dexieTable.bulkAdd(missing).catch((err: unknown) => {
            // Si otra carga insertó alguno al mismo tiempo, Dexie agrega el resto igual (BulkError).
            if ((err as { name?: string })?.name !== 'BulkError') throw err;
        });
    } finally {
        if (!alreadyPulling) db.isPulling = false;
    }
    return missing.length;
}

/** Trae del servidor las oportunidades/cuentas referenciadas que no están localmente. */
async function hydrateReferences(activities: Row[]): Promise<void> {
    const oppIds = new Set<string>();
    for (const a of activities) if (typeof a.opportunity_id === 'string') oppIds.add(a.opportunity_id);
    const localOpps = await db.opportunities.bulkGet(Array.from(oppIds));
    const missingOppIds = Array.from(oppIds).filter((_, i) => !localOpps[i]);

    const fetchedOpps: Row[] = [];
    for (const ids of chunk(missingOppIds, ID_CHUNK)) {
        const { data, error } = await supabase.from('CRM_Oportunidades').select('*').in('id', ids).eq('is_deleted', false);
        if (error) throw error;
        fetchedOpps.push(...((data || []) as Row[]));
    }
    // La visibilidad (asesor: dueño/colaborador) la siguen aplicando las vistas sobre la copia local,
    // igual que con lo que trae la sincronización normal.
    const oppsToAdd = fetchedOpps;
    await addMissing('opportunities', 'CRM_Oportunidades', oppsToAdd);

    const accountIds = new Set<string>();
    for (const a of activities) if (typeof a.account_id === 'string') accountIds.add(a.account_id);
    for (const o of oppsToAdd) if (typeof o.account_id === 'string') accountIds.add(o.account_id);
    const localAccounts = await db.accounts.bulkGet(Array.from(accountIds));
    const missingAccountIds = Array.from(accountIds).filter((_, i) => !localAccounts[i]);

    const fetchedAccounts: Row[] = [];
    for (const ids of chunk(missingAccountIds, ID_CHUNK)) {
        const { data, error } = await supabase.from('CRM_Cuentas').select('*').in('id', ids).eq('is_deleted', false);
        if (error) throw error;
        fetchedAccounts.push(...((data || []) as Row[]));
    }
    await addMissing('accounts', 'CRM_Cuentas', fetchedAccounts);
}

/**
 * Pestaña Actividades de una oportunidad: trae TODAS sus actividades del servidor
 * (no solo las del caché de 3.000). Devuelve cuántas se agregaron localmente.
 */
export async function hydrateOpportunityActivities(opportunityId: string, viewer: Viewer): Promise<number> {
    if (!opportunityId || !isOnline()) return 0;
    if (isSellerRole(viewer.viewerRole) && !viewer.viewerId) return 0;

    const rows = await fetchPaged((from, to) => {
        let query = supabase
            .from('CRM_Actividades')
            .select('*')
            .eq('is_deleted', false)
            .eq('opportunity_id', opportunityId);
        if (isSellerRole(viewer.viewerRole)) query = query.eq('user_id', viewer.viewerId as string);
        return query.order('fecha_inicio', { ascending: false }).order('id', { ascending: false }).range(from, to);
    }, MAX_OPPORTUNITY_ACTIVITIES);

    return addMissing('activities', 'CRM_Actividades', rows);
}

/**
 * Búsqueda en /actividades: busca en el servidor actividades cuyo asunto, oportunidad
 * (nombre, p. ej. "POT42202") o cuenta coincidan con el texto, y las guarda localmente
 * (con su oportunidad y cuenta, para que funcionen los filtros de canal).
 * Los filtros de la pantalla (canal, estado, fechas, permisos) se siguen aplicando localmente.
 */
export async function hydrateActivitiesForSearch(searchText: string, viewer: Viewer): Promise<number> {
    const text = (searchText || '').trim();
    if (text.length < 3 || !isOnline()) return 0;
    if (getCellphoneSearchDigits(text)) return 0; // la búsqueda por celular tiene su propio flujo
    if (isSellerRole(viewer.viewerRole) && !viewer.viewerId) return 0;

    const tokens = getSearchTokens(text).filter(t => /[\p{L}\p{N}]/u.test(t));
    if (tokens.length === 0) return 0;

    let oppQuery = supabase.from('CRM_Oportunidades').select('id').eq('is_deleted', false);
    let accQuery = supabase.from('CRM_Cuentas').select('id').eq('is_deleted', false);
    for (const token of tokens) {
        oppQuery = applyAccentInsensitiveFilter(oppQuery, 'nombre', token);
        accQuery = applyAccentInsensitiveFilter(accQuery, 'nombre', token);
    }
    const [oppRes, accRes] = await Promise.all([oppQuery.limit(MAX_SEARCH_MATCHES), accQuery.limit(MAX_SEARCH_MATCHES)]);
    if (oppRes.error) throw oppRes.error;
    if (accRes.error) throw accRes.error;
    const oppIds = (oppRes.data || []).map(o => o.id as string);
    const accIds = (accRes.data || []).map(a => a.id as string);

    const conditions: string[] = [];
    if (oppIds.length > 0) conditions.push(`opportunity_id.in.(${oppIds.join(',')})`);
    if (accIds.length > 0) conditions.push(`account_id.in.(${accIds.join(',')})`);
    conditions.push(tokens.length === 1
        ? accentInsensitiveCondition('asunto', tokens[0])
        : `and(${tokens.map(t => accentInsensitiveCondition('asunto', t)).join(',')})`);

    const rows = await fetchPaged((from, to) => {
        let query = supabase
            .from('CRM_Actividades')
            .select('*')
            .eq('is_deleted', false)
            .or(conditions.join(','));
        if (isSellerRole(viewer.viewerRole)) query = query.eq('user_id', viewer.viewerId as string);
        return query.order('fecha_inicio', { ascending: false }).order('id', { ascending: false }).range(from, to);
    }, MAX_SEARCH_ACTIVITIES);

    await hydrateReferences(rows);
    return addMissing('activities', 'CRM_Actividades', rows);
}

/**
 * Actividades propias del usuario (user_id = él): todas las pendientes y las de los
 * últimos 12 meses. La sincronización inicial solo trae las 3.000 más recientes de TODA
 * la empresa, así que a un asesor le faltaban casi todas las suyas en /actividades.
 * Se ejecuta una vez por copia local (ver syncEngine.pullChanges). Devuelve cuántas agregó.
 */
export async function hydrateOwnActivities(userId: string, now: Date = new Date()): Promise<number> {
    if (!userId || !isOnline()) return 0;
    const since = new Date(now);
    since.setMonth(since.getMonth() - OWN_HISTORY_MONTHS);

    const rows = await fetchPaged((from, to) => supabase
        .from('CRM_Actividades')
        .select('*')
        .eq('is_deleted', false)
        .eq('user_id', userId)
        .or(`is_completed.eq.false,fecha_inicio.gte.${since.toISOString()}`)
        .order('fecha_inicio', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to), MAX_OWN_ACTIVITIES);

    await hydrateReferences(rows);
    return addMissing('activities', 'CRM_Actividades', rows);
}
