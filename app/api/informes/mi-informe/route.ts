import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
    buildMiInformeSheets,
    buildMiInformeWorkbook,
    miInformeFileName,
    type MiInformeLookups
} from '@/lib/informes/miInforme';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;
const IN_CHUNK = 100;
type Row = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchAll(build: (from: number, to: number) => any): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await build(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        out.push(...((data as Row[]) || []));
        if (!data || data.length < PAGE_SIZE) break;
    }
    return out;
}

async function fetchByIds(supabase: SupabaseClient, table: string, select: string, column: string, ids: string[], extra?: (q: any) => any): Promise<Row[]> {
    const out: Row[] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const chunk = ids.slice(i, i + IN_CHUNK);
        const rows = await fetchAll((from, to) => {
            let q: any = supabase.from(table).select(select).in(column, chunk);
            if (extra) q = extra(q);
            return q.range(from, to);
        });
        out.push(...rows);
    }
    return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const toMap = (rows: Row[] | null | undefined, label = 'nombre') =>
    new Map<string | number, string>((rows || []).map((r) => [r.id as string | number, String(r[label] ?? '')]));

const uniqueById = (rows: Row[]) => Array.from(new Map(rows.map((r) => [String(r.id), r])).values());

/**
 * GET /api/informes/mi-informe
 * Devuelve un Excel con las cuentas, contactos, oportunidades y actividades del
 * usuario que hace la petición. El usuario sale SIEMPRE de la sesión validada en el
 * servidor (auth.getUser), nunca de parámetros, así que un asesor no puede pedir
 * datos de otro.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    try {
        const uid = user.id;
        const { data: crmUser } = await supabase
            .from('CRM_Usuarios').select('id, full_name, email, is_active').eq('id', uid).maybeSingle();
        if (crmUser && crmUser.is_active === false) {
            return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });
        }
        const userName = crmUser?.full_name || crmUser?.email || user.email || 'Asesor';

        // 1. Cuentas asignadas al asesor
        const cuentas = await fetchAll((from, to) => supabase
            .from('CRM_Cuentas').select('*')
            .eq('owner_user_id', uid).eq('is_deleted', false)
            .order('nombre').range(from, to));
        const myAccountIds = cuentas.map((c) => String(c.id));

        // 2. Oportunidades del asesor
        const oportunidades = await fetchAll((from, to) => supabase
            .from('CRM_Oportunidades')
            .select('id, nombre, account_id, estado_id, fase_id, amount, currency_id, probabilidad, probability, fecha_cierre_estimada, segmento_id, departamento_id, ciudad_id, origen_oportunidad, created_at')
            .eq('owner_user_id', uid).eq('is_deleted', false)
            .order('created_at', { ascending: false }).range(from, to));

        // 3. Contactos: de sus cuentas o creados por él
        const contactSelect = 'id, nombre, cargo, email, telefono, account_id, es_principal, created_at';
        const contactosPropios = await fetchAll((from, to) => supabase
            .from('CRM_Contactos').select(contactSelect)
            .eq('created_by', uid).eq('is_deleted', false).range(from, to));
        const contactosDeCuentas = await fetchByIds(supabase, 'CRM_Contactos', contactSelect, 'account_id', myAccountIds,
            (q) => q.eq('is_deleted', false));
        const contactos = uniqueById([...contactosDeCuentas, ...contactosPropios]);

        // 4. Actividades asignadas o creadas por él
        const actSelect = 'id, asunto, descripcion, fecha_inicio, fecha_fin, is_completed, tipo_actividad, tipo_actividad_id, clasificacion_id, subclasificacion_id, account_id, opportunity_id, created_at';
        const actividadesAsignadas = await fetchAll((from, to) => supabase
            .from('CRM_Actividades').select(actSelect)
            .eq('user_id', uid).eq('is_deleted', false).range(from, to));
        const actividadesCreadas = await fetchAll((from, to) => supabase
            .from('CRM_Actividades').select(actSelect)
            .eq('created_by', uid).eq('is_deleted', false).range(from, to));
        const actividades = uniqueById([...actividadesAsignadas, ...actividadesCreadas])
            .sort((a, b) => String(b.fecha_inicio || '').localeCompare(String(a.fecha_inicio || '')));

        // Nombres de cuentas/oportunidades referenciadas que no son del asesor
        const accountNames = toMap(cuentas);
        const missingAccounts = Array.from(new Set(
            [...contactos, ...oportunidades, ...actividades].map((r) => r.account_id).filter(Boolean).map(String)
        )).filter((id) => !accountNames.has(id));
        (await fetchByIds(supabase, 'CRM_Cuentas', 'id, nombre', 'id', missingAccounts))
            .forEach((r) => accountNames.set(r.id as string, String(r.nombre ?? '')));

        const oppNames = toMap(oportunidades);
        const missingOpps = Array.from(new Set(actividades.map((a) => a.opportunity_id).filter(Boolean).map(String)))
            .filter((id) => !oppNames.has(id));
        (await fetchByIds(supabase, 'CRM_Oportunidades', 'id, nombre', 'id', missingOpps))
            .forEach((r) => oppNames.set(r.id as string, String(r.nombre ?? '')));

        const [canales, fases, estados, segmentos, departamentos, ciudades, tipos, clasif, subclasif] = await Promise.all([
            supabase.from('CRM_Canales').select('id, nombre'),
            supabase.from('CRM_FasesOportunidad').select('id, nombre'),
            supabase.from('CRM_EstadosOportunidad').select('id, nombre'),
            supabase.from('CRM_Segmentos').select('id, nombre'),
            supabase.from('CRM_Departamentos').select('id, nombre'),
            fetchAll((from, to) => supabase.from('CRM_Ciudades').select('id, nombre').range(from, to)),
            supabase.from('CRM_TiposActividad').select('id, nombre'),
            supabase.from('CRM_Activity_Clasificacion').select('id, nombre'),
            supabase.from('CRM_Activity_Subclasificacion').select('id, nombre')
        ]);

        const lookups: MiInformeLookups = {
            canales: toMap(canales.data),
            fases: toMap(fases.data),
            estados: toMap(estados.data),
            segmentos: toMap(segmentos.data),
            departamentos: toMap(departamentos.data),
            ciudades: toMap(ciudades),
            tiposActividad: toMap(tipos.data),
            clasificaciones: toMap(clasif.data),
            subclasificaciones: toMap(subclasif.data),
            cuentas: accountNames,
            oportunidades: oppNames
        };

        const sheets = buildMiInformeSheets({ cuentas, contactos, oportunidades, actividades }, lookups);
        const workbook = await buildMiInformeWorkbook(sheets, { userName });
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = miInformeFileName(userName);

        return new NextResponse(buffer as ArrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        console.error('[mi-informe] Error generando informe:', error);
        return NextResponse.json({ error: 'No se pudo generar el informe. Intenta de nuevo.' }, { status: 500 });
    }
}
