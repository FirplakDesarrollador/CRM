import * as ExcelJS from 'exceljs';

/**
 * "Mi informe": Excel personal de cada asesor con SUS cuentas, contactos,
 * oportunidades y actividades. Las filas se arman aquí (funciones puras, con
 * pruebas) y la ruta /api/informes/mi-informe decide QUÉ registros entran,
 * siempre a partir del usuario autenticado en el servidor (no de parámetros).
 */

type Row = Record<string, unknown>;
type IdMap = Map<string | number, string>;

export interface MiInformeLookups {
    canales: IdMap;
    fases: IdMap;
    estados: IdMap;
    segmentos: IdMap;
    departamentos: IdMap;
    ciudades: IdMap;
    tiposActividad: IdMap;
    clasificaciones: IdMap;
    subclasificaciones: IdMap;
    cuentas: IdMap; // id -> nombre (de las cuentas del asesor + las referenciadas)
    oportunidades: IdMap; // id -> nombre
}

export interface MiInformeData {
    cuentas: Row[];
    contactos: Row[];
    oportunidades: Row[];
    actividades: Row[];
}

export interface SheetDef {
    name: string;
    columns: { header: string; key: string; width?: number }[];
    rows: Row[];
}

const lookup = (map: IdMap, id: unknown): string => {
    if (id === null || id === undefined || id === '') return '';
    return map.get(id as string | number) ?? map.get(String(id)) ?? (Number.isFinite(Number(id)) ? map.get(Number(id)) : undefined) ?? '';
};

const asDate = (value: unknown): Date | string => {
    if (!value) return '';
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d;
};

const asText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export function buildMiInformeSheets(data: MiInformeData, lk: MiInformeLookups): SheetDef[] {
    const cuentas: SheetDef = {
        name: 'Cuentas',
        columns: [
            { header: 'NOMBRE CUENTA', key: 'nombre', width: 40 },
            { header: 'NIT', key: 'nit', width: 18 },
            { header: 'CANAL', key: 'canal', width: 22 },
            { header: 'TELÉFONO', key: 'telefono', width: 18 },
            { header: 'EMAIL', key: 'email', width: 30 },
            { header: 'DEPARTAMENTO', key: 'departamento', width: 20 },
            { header: 'CIUDAD', key: 'ciudad', width: 20 },
            { header: 'DIRECCIÓN', key: 'direccion', width: 30 },
            { header: 'PREMIUM', key: 'premium', width: 10 },
            { header: 'CREADA EL', key: 'created_at', width: 18 },
            { header: 'ID', key: 'id', width: 38 }
        ],
        rows: data.cuentas.map((c) => ({
            id: c.id,
            nombre: asText(c.nombre),
            nit: asText(c.nit) || (c.nit_base ? `${c.nit_base}${c.nit_sufijo ? '-' + c.nit_sufijo : ''}` : ''),
            canal: lookup(lk.canales, c.canal_id) || asText(c.canal_id),
            telefono: asText(c.telefono),
            email: asText(c.email),
            departamento: lookup(lk.departamentos, c.departamento_id),
            ciudad: lookup(lk.ciudades, c.ciudad_id) || asText(c.ciudad),
            direccion: asText(c.direccion),
            premium: c.es_premium ? 'Sí' : 'No',
            created_at: asDate(c.created_at)
        }))
    };

    const contactos: SheetDef = {
        name: 'Contactos',
        columns: [
            { header: 'NOMBRE', key: 'nombre', width: 30 },
            { header: 'CARGO', key: 'cargo', width: 20 },
            { header: 'EMAIL', key: 'email', width: 30 },
            { header: 'TELÉFONO', key: 'telefono', width: 18 },
            { header: 'CUENTA', key: 'cuenta', width: 35 },
            { header: 'PRINCIPAL', key: 'principal', width: 10 },
            { header: 'CREADO EL', key: 'created_at', width: 18 },
            { header: 'ID', key: 'id', width: 38 }
        ],
        rows: data.contactos.map((c) => ({
            id: c.id,
            nombre: asText(c.nombre),
            cargo: asText(c.cargo),
            email: asText(c.email),
            telefono: asText(c.telefono),
            cuenta: lookup(lk.cuentas, c.account_id),
            principal: c.es_principal ? 'Sí' : 'No',
            created_at: asDate(c.created_at)
        }))
    };

    const oportunidades: SheetDef = {
        name: 'Oportunidades',
        columns: [
            { header: 'NOMBRE OPORTUNIDAD', key: 'nombre', width: 35 },
            { header: 'CUENTA', key: 'cuenta', width: 35 },
            { header: 'ESTADO', key: 'estado', width: 15 },
            { header: 'FASE', key: 'fase', width: 20 },
            { header: 'VALOR', key: 'amount', width: 15 },
            { header: 'MONEDA', key: 'currency_id', width: 10 },
            { header: 'PROBABILIDAD (%)', key: 'probabilidad', width: 15 },
            { header: 'FECHA CIERRE EST.', key: 'fecha_cierre_estimada', width: 18 },
            { header: 'SEGMENTO', key: 'segmento', width: 22 },
            { header: 'DEPARTAMENTO', key: 'departamento', width: 20 },
            { header: 'CIUDAD', key: 'ciudad', width: 20 },
            { header: 'ORIGEN', key: 'origen', width: 20 },
            { header: 'CREADA EL', key: 'created_at', width: 18 },
            { header: 'ID', key: 'id', width: 38 }
        ],
        rows: data.oportunidades.map((o) => ({
            id: o.id,
            nombre: asText(o.nombre),
            cuenta: lookup(lk.cuentas, o.account_id),
            estado: lookup(lk.estados, o.estado_id),
            fase: lookup(lk.fases, o.fase_id),
            amount: Number(o.amount) || 0,
            currency_id: asText(o.currency_id),
            probabilidad: o.probabilidad ?? o.probability ?? '',
            fecha_cierre_estimada: asDate(o.fecha_cierre_estimada),
            segmento: lookup(lk.segmentos, o.segmento_id),
            departamento: lookup(lk.departamentos, o.departamento_id),
            ciudad: lookup(lk.ciudades, o.ciudad_id),
            origen: asText(o.origen_oportunidad),
            created_at: asDate(o.created_at)
        }))
    };

    const actividades: SheetDef = {
        name: 'Actividades',
        columns: [
            { header: 'ASUNTO', key: 'asunto', width: 35 },
            { header: 'TIPO', key: 'tipo', width: 18 },
            { header: 'CLASIFICACIÓN', key: 'clasificacion', width: 22 },
            { header: 'SUBCLASIFICACIÓN', key: 'subclasificacion', width: 22 },
            { header: 'CUENTA', key: 'cuenta', width: 35 },
            { header: 'OPORTUNIDAD', key: 'oportunidad', width: 35 },
            { header: 'INICIO', key: 'fecha_inicio', width: 18 },
            { header: 'VENCIMIENTO', key: 'fecha_fin', width: 18 },
            { header: 'ESTADO', key: 'estado', width: 14 },
            { header: 'NOTAS', key: 'descripcion', width: 50 },
            { header: 'ID', key: 'id', width: 38 }
        ],
        rows: data.actividades.map((a) => ({
            id: a.id,
            asunto: asText(a.asunto),
            tipo: lookup(lk.tiposActividad, a.tipo_actividad_id) || asText(a.tipo_actividad),
            clasificacion: lookup(lk.clasificaciones, a.clasificacion_id),
            subclasificacion: lookup(lk.subclasificaciones, a.subclasificacion_id),
            cuenta: lookup(lk.cuentas, a.account_id),
            oportunidad: lookup(lk.oportunidades, a.opportunity_id),
            fecha_inicio: asDate(a.fecha_inicio),
            fecha_fin: asDate(a.fecha_fin),
            estado: a.is_completed ? 'Completada' : 'Pendiente',
            descripcion: asText(a.descripcion)
        }))
    };

    return [cuentas, contactos, oportunidades, actividades];
}

export async function buildMiInformeWorkbook(sheets: SheetDef[], meta: { userName: string; generatedAt?: Date }): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM Firplak';
    workbook.created = meta.generatedAt ?? new Date();

    const resumen = workbook.addWorksheet('Resumen');
    resumen.columns = [{ header: 'Mi informe', key: 'k', width: 28 }, { header: '', key: 'v', width: 40 }];
    resumen.getRow(1).font = { bold: true, size: 14 };
    resumen.addRow({ k: 'Asesor', v: meta.userName });
    resumen.addRow({ k: 'Generado', v: (meta.generatedAt ?? new Date()).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) });
    sheets.forEach((s) => resumen.addRow({ k: s.name, v: s.rows.length }));

    for (const sheet of sheets) {
        const ws = workbook.addWorksheet(sheet.name);
        ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
        const header = ws.getRow(1);
        header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF254153' } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.addRows(sheet.rows);
        sheet.columns.forEach((c) => {
            if (['created_at', 'fecha_inicio', 'fecha_fin', 'fecha_cierre_estimada'].includes(c.key)) {
                ws.getColumn(c.key).numFmt = 'dd/mm/yyyy hh:mm';
            }
        });
        if (sheet.columns.some((c) => c.key === 'amount')) ws.getColumn('amount').numFmt = '#,##0';
    }
    return workbook;
}

export function miInformeFileName(userName: string, date = new Date()): string {
    const slug = userName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'asesor';
    const day = date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    return `Mi_informe_${slug}_${day}.xlsx`;
}
