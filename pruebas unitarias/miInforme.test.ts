import { describe, expect, it } from 'vitest';
import * as ExcelJS from 'exceljs';
import { buildMiInformeSheets, buildMiInformeWorkbook, miInformeFileName, type MiInformeLookups } from '@/lib/informes/miInforme';

const m = (entries: [string | number, string][]) => new Map<string | number, string>(entries);

const lookups: MiInformeLookups = {
    canales: m([['OBRAS_NAC', 'Obras Nacional']]),
    fases: m([[3, 'Cotización']]),
    estados: m([[1, 'Abierta']]),
    segmentos: m([[2, 'Constructoras']]),
    departamentos: m([[5, 'Antioquia']]),
    ciudades: m([[50, 'Medellín']]),
    tiposActividad: m([[7, 'Visita']]),
    clasificaciones: m([]),
    subclasificaciones: m([]),
    cuentas: m([['acc-1', 'Constructora Uno']]),
    oportunidades: m([['opp-1', 'Torre Norte']])
};

describe('Mi informe (Excel personal del asesor)', () => {
    const sheets = buildMiInformeSheets({
        cuentas: [{ id: 'acc-1', nombre: 'Constructora Uno', nit_base: '900123', nit_sufijo: '4', canal_id: 'OBRAS_NAC', departamento_id: 5, ciudad_id: 50, es_premium: true, created_at: '2026-10-01T10:00:00Z' }],
        contactos: [{ id: 'c-1', nombre: 'Laura', account_id: 'acc-1', es_principal: true }],
        oportunidades: [{ id: 'opp-1', nombre: 'Torre Norte', account_id: 'acc-1', estado_id: 1, fase_id: 3, amount: '1500000', segmento_id: 2 }],
        actividades: [{ id: 'a-1', asunto: 'Visita obra', tipo_actividad_id: 7, account_id: 'acc-1', opportunity_id: 'opp-1', is_completed: false, descripcion: 'Texto con "comillas" y\nsaltos' }]
    }, lookups);

    it('arma las 4 hojas con nombres legibles', () => {
        expect(sheets.map(s => s.name)).toEqual(['Cuentas', 'Contactos', 'Oportunidades', 'Actividades']);
        expect(sheets[0].rows[0]).toMatchObject({ nit: '900123-4', canal: 'Obras Nacional', ciudad: 'Medellín', premium: 'Sí' });
        expect(sheets[1].rows[0]).toMatchObject({ cuenta: 'Constructora Uno', principal: 'Sí' });
        expect(sheets[2].rows[0]).toMatchObject({ estado: 'Abierta', fase: 'Cotización', amount: 1500000, segmento: 'Constructoras' });
        expect(sheets[3].rows[0]).toMatchObject({ tipo: 'Visita', oportunidad: 'Torre Norte', estado: 'Pendiente' });
    });

    it('genera un xlsx válido que se puede volver a leer', async () => {
        const wb = await buildMiInformeWorkbook(sheets, { userName: 'Ana', generatedAt: new Date('2026-10-28T15:00:00Z') });
        const buffer = await wb.xlsx.writeBuffer();
        const back = new ExcelJS.Workbook();
        await back.xlsx.load(buffer as ArrayBuffer);
        expect(back.worksheets.map(w => w.name)).toEqual(['Resumen', 'Cuentas', 'Contactos', 'Oportunidades', 'Actividades']);
        expect(back.getWorksheet('Actividades')!.getRow(2).getCell(10).value).toBe('Texto con "comillas" y\nsaltos');
    });

    it('nombre de archivo sin tildes ni espacios', () => {
        expect(miInformeFileName('José Muñoz', new Date('2026-10-28T15:00:00Z'))).toBe('Mi_informe_Jose_Munoz_2026-10-28.xlsx');
    });

    it('incluye fecha_actividad y estado_actividad en la hoja de Oportunidades', () => {
        const sheetsWithAct = buildMiInformeSheets({
            cuentas: [],
            contactos: [],
            oportunidades: [
                {
                    id: 'opp-1',
                    nombre: 'Torre Norte',
                    actividades: [{ id: 'a-1', fecha_fin: '2026-10-27T13:26:00-05:00', is_completed: false }]
                },
                {
                    id: 'opp-2',
                    nombre: 'Torre Sur',
                    actividades: []
                }
            ],
            actividades: []
        }, lookups);

        expect(sheetsWithAct[2].columns.some(c => c.key === 'fecha_actividad')).toBe(true);
        expect(sheetsWithAct[2].columns.some(c => c.key === 'estado_actividad')).toBe(true);
        expect(sheetsWithAct[2].rows[0]).toMatchObject({ fecha_actividad: '27/10/2026 13:26', estado_actividad: 'Pendiente' });
        expect(sheetsWithAct[2].rows[1]).toMatchObject({ fecha_actividad: '-', estado_actividad: '-' });
    });
});
