import { describe, it, expect } from 'vitest';
import {
    buildOpportunityHotRow,
    resolveHotRowData,
    OPPORTUNITY_TABLE_COLUMN_KEYS,
    OpportunityInput,
    OpportunityHotRow
} from '@/lib/opportunityTableHelpers';
import { parseHandsontableDate, DATE_FILTER_PRESETS } from '@/lib/dateFilterHelpers';

describe('Filtros internos de tabla de oportunidades', () => {
    it('debe mapear "actividades" a un string legible y no a un objeto [object Object]', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-1',
            nombre: 'Negocio Venta Grifería',
            amount: 5000000,
            account: {
                nombre: 'Constructora Bolívar',
                ciudad: 'Medellín',
                canal_id: 'OBRAS_NAC',
                pais_id: 1
            },
            actividades: [
                { id: 'act-1', fecha_fin: '2020-01-01', is_completed: false } // Vencida
            ]
        };

        const countryMap: Record<number, string> = { 1: 'Colombia' };
        const hotRow = buildOpportunityHotRow(mockOpp, countryMap);

        // La propiedad 'actividades' DEBE ser un string para que el filtro interno de Handsontable
        // no muestre '[object Object]' y permita buscar por texto ("atrasada", "programada", "sin actividad").
        expect(typeof hotRow.actividades).toBe('string');
        expect(hotRow.actividades).toBe('1 atrasada');
        expect(hotRow.actividades).not.toBe('[object Object]');
        expect(hotRow.actividades_status).toBe('overdue');
    });

    it('debe mapear oportunidad sin actividades a "Sin actividad"', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-2',
            nombre: 'Oportunidad Nueva',
            actividades: []
        };

        const hotRow = buildOpportunityHotRow(mockOpp, {});
        expect(hotRow.actividades).toBe('Sin actividad');
        expect(hotRow.actividades_status).toBe('none');
    });

    it('todas las columnas filtrables deben tener valores primitivos (string/number), nunca objetos ni undefined', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-3',
            nombre: null,
            amount: null,
            account: null,
            actividades: null,
            fase_data: null,
            estado_data: null,
            created_at: null,
            fecha_cierre_estimada: null,
            vendedor: null
        };

        const hotRow = buildOpportunityHotRow(mockOpp, {});

        // Verificar que ninguna columna visible de la tabla sea un objeto ni null
        for (const colKey of OPPORTUNITY_TABLE_COLUMN_KEYS) {
            const value = hotRow[colKey as keyof OpportunityHotRow];
            expect(typeof value).not.toBe('object');
            expect(value).not.toBeNull();
            expect(value).not.toBeUndefined();
        }
    });

    it('debe resolver la fila física correcta cuando la tabla tiene filtros aplicados (toPhysicalRow)', () => {
        const sourceData = [
            { id: 'opp-1', nombre: 'Oportunidad 1' },
            { id: 'opp-2', nombre: 'Oportunidad 2' },
            { id: 'opp-3', nombre: 'Oportunidad 3' }
        ];

        // Simulamos Handsontable cuando se ha filtrado y la fila visual 0 corresponde a la física 2
        const mockHotInstance = {
            toPhysicalRow: (visualRow: number) => {
                if (visualRow === 0) return 2; // La fila visual 0 es la fila 2 de sourceData ('opp-3')
                return -1;
            },
            getSourceDataAtRow: (physicalRow: number) => sourceData[physicalRow]
        };

        const resolvedOpp = resolveHotRowData(mockHotInstance, 0, sourceData);
        expect(resolvedOpp).toBeDefined();
        expect(resolvedOpp!.id).toBe('opp-3');
        expect(resolvedOpp!.nombre).toBe('Oportunidad 3');
    });

    it('OPPORTUNITY_TABLE_COLUMN_KEYS debe incluir "actividades" en la posición exacta', () => {
        expect(OPPORTUNITY_TABLE_COLUMN_KEYS).toContain('actividades');
        expect(OPPORTUNITY_TABLE_COLUMN_KEYS).toEqual([
            'nombre',
            'cuenta',
            'actividades',
            'pais',
            'ciudad',
            'canal',
            'origen',
            'fase',
            'estado',
            'creada',
            'categoria',
            'valor',
            'cierre',
            'vendedor'
        ]);
    });

    it('debe mapear "categoria_oportunidad" a "categoria" como string formateado o "-"', () => {
        const mockOppWithCats: OpportunityInput = {
            id: 'opp-cats-1',
            categoria_oportunidad: ['Hidromasajes', 'Baños']
        };
        const rowWithCats = buildOpportunityHotRow(mockOppWithCats, {});
        expect(rowWithCats.categoria).toBe('Hidromasajes, Baños');

        const mockOppWithStringCats: OpportunityInput = {
            id: 'opp-cats-2',
            categoria_oportunidad: 'Cocinas, Institucional'
        };
        const rowWithStringCats = buildOpportunityHotRow(mockOppWithStringCats, {});
        expect(rowWithStringCats.categoria).toBe('Cocinas, Institucional');

        const mockOppEmptyCats: OpportunityInput = {
            id: 'opp-cats-3',
            categoria_oportunidad: null
        };
        const rowEmptyCats = buildOpportunityHotRow(mockOppEmptyCats, {});
        expect(rowEmptyCats.categoria).toBe('-');
    });

    it('debe formatear "cierre" con DD/MM/AAAA para permitir filtrado por condición de fecha en Handsontable', () => {
        const mockOpp: OpportunityInput = {
            id: 'opp-date',
            fecha_cierre_estimada: '2026-11-20T12:00:00Z',
            created_at: '2026-10-21T08:00:00Z'
        };

        const hotRow = buildOpportunityHotRow(mockOpp, {});
        // "cierre" debe incluir año de 4 dígitos para que Handsontable lo reconozca como fecha
        expect(hotRow.cierre).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        expect(hotRow.creada).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('parseHandsontableDate debe convertir DD/MM/AAAA a YYYY-MM-DD para el servidor Supabase', () => {
        expect(parseHandsontableDate('21/10/2026')).toBe('2026-10-21');
        expect(parseHandsontableDate('01/04/2024')).toBe('2024-04-01');
        expect(parseHandsontableDate('-')).toBeNull();
        expect(parseHandsontableDate('')).toBeNull();
    });

    it('DATE_FILTER_PRESETS debe incluir preset "up_to_today" (Hasta la fecha / Anteriores a hoy)', () => {
        const upToToday = DATE_FILTER_PRESETS.find(p => p.id === 'up_to_today');
        expect(upToToday).toBeDefined();
        const fakeNow = new Date('2026-10-21T12:00:00Z');
        const range = upToToday!.getRange(fakeNow);
        expect(range.startDate).toBeNull();
        expect(range.endDate).toBe('2026-10-21');
    });

    it('toStartOfDayISO y toEndOfDayISO deben abarcar el día completo local y no excluir oportunidades creadas hoy por desajuste UTC', async () => {
        const { toStartOfDayISO, toEndOfDayISO } = await import('@/lib/dateFilterHelpers');

        const testDate = '2026-10-22';
        const startISO = toStartOfDayISO(testDate);
        const endISO = toEndOfDayISO(testDate);

        expect(startISO).toBeDefined();
        expect(endISO).toBeDefined();

        // Oportunidad real creada hoy a las 08:11 AM hora Colombia (13:11:00 UTC)
        const oppToday1 = '2026-10-22T13:11:00.000Z';
        // Oportunidad real creada hoy a las 01:25 PM hora Colombia (18:25:00 UTC)
        const oppToday2 = '2026-10-22T18:25:00.000Z';

        // La fecha de fin convertida a ISO DEBE ser mayor o igual a las oportunidades creadas hoy
        expect(new Date(oppToday1).getTime()).toBeLessThanOrEqual(new Date(endISO!).getTime());
        expect(new Date(oppToday2).getTime()).toBeLessThanOrEqual(new Date(endISO!).getTime());
        expect(new Date(oppToday1).getTime()).toBeGreaterThanOrEqual(new Date(startISO!).getTime());
        expect(new Date(oppToday2).getTime()).toBeGreaterThanOrEqual(new Date(startISO!).getTime());
    });

    it('debe ordenar oportunidades de la más nueva a la más antigua cuando sortField="created_at" y sortAsc=false', () => {
        const opps = [
            { id: 'old-1', created_at: '2024-01-15T10:00:00Z' },
            { id: 'newest-1', created_at: '2026-10-21T08:00:00Z' },
            { id: 'mid-1', created_at: '2025-06-20T12:00:00Z' }
        ];

        // Lógica de ordenamiento idéntica a useOpportunitiesServer (sortAsc = false)
        const sortAsc = false;
        opps.sort((a, b) => {
            const valA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const valB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

        expect(opps[0].id).toBe('newest-1'); // 2026 primero
        expect(opps[1].id).toBe('mid-1');    // 2025 segundo
        expect(opps[2].id).toBe('old-1');    // 2024 al final
    });

    it('isColumnFilterActive debe detectar correctamente filtros activos en cada columna', async () => {
        const { isColumnFilterActive, formatColumnHeaderTitle } = await import('@/lib/opportunityColumnFilterHelpers');

        const stateEmpty = {
            channel: null,
            phase: null,
            ownerIds: [],
            status: 'open' as const,
            origin: null,
            country: null,
            city: null,
            startDate: null,
            endDate: null,
            startClose: null,
            endClose: null
        };

        expect(isColumnFilterActive('canal', stateEmpty)).toBe(false);
        expect(isColumnFilterActive('fase', stateEmpty)).toBe(false);
        expect(isColumnFilterActive('vendedor', stateEmpty)).toBe(false);
        expect(isColumnFilterActive('estado', stateEmpty)).toBe(false); // 'open' is default
        expect(isColumnFilterActive('creada', stateEmpty)).toBe(false);

        const stateFiltered = {
            channel: 'OBRAS_INT',
            phase: 64,
            ownerIds: ['user-1'],
            status: 'won' as const,
            origin: 'WhatsApp',
            country: 1,
            city: 'Medellín',
            startDate: '2026-10-01',
            endDate: null,
            startClose: null,
            endClose: '2026-12-31'
        };

        expect(isColumnFilterActive('canal', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('fase', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('vendedor', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('estado', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('origen', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('pais', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('ciudad', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('creada', stateFiltered)).toBe(true);
        expect(isColumnFilterActive('cierre', stateFiltered)).toBe(true);

        expect(formatColumnHeaderTitle('CANAL', '', false)).toBe('CANAL');
        expect(formatColumnHeaderTitle('CANAL', '↑', true)).toBe('CANAL ↑ 🔵');
        expect(formatColumnHeaderTitle('CANAL', '', true)).toBe('CANAL 🔵');

        // Prospecto (-1) debe considerarse filtro activo
        expect(isColumnFilterActive('fase', { ...stateEmpty, phase: -1 })).toBe(true);
    });

    it('getAvailablePhasesForChannel debe filtrar por canal, descartar cerradas y deduplicar por nombre', async () => {
        const { getAvailablePhasesForChannel, getEquivalentPhaseIds, PROSPECTO_PHASE_ID } = await import('@/lib/opportunityColumnFilterHelpers');

        const mockPhases = [
            // OBRAS_NAC
            { id: 56, nombre: 'Visita', canal_id: 'OBRAS_NAC', orden: 1 },
            { id: 97, nombre: 'Visita', canal_id: 'OBRAS_NAC', orden: 1 }, // Duplicado en BD
            { id: 57, nombre: 'Presentación de propuesta', canal_id: 'OBRAS_NAC', orden: 2 },
            { id: 61, nombre: 'Cerrada Ganada', canal_id: 'OBRAS_NAC', orden: 6 }, // Estado cerrado (excluir de embudo)
            { id: 62, nombre: 'Cerrada Perdida', canal_id: 'OBRAS_NAC', orden: 7 }, // Estado cerrado (excluir de embudo)

            // PROPIO
            { id: 82, nombre: 'Primer contacto', canal_id: 'PROPIO', orden: 1 },
            { id: 83, nombre: 'Presentación de propuesta', canal_id: 'PROPIO', orden: 2 },
            { id: 88, nombre: 'Cerrada Perdida', canal_id: 'PROPIO', orden: 7 },

            // FERIA
            { id: 129, nombre: 'Cerrada Perdida', canal_id: 'FERIA', orden: 7 }
        ];

        // 1. Si no hay canal seleccionado, no debe devolver fases mezcladas
        expect(getAvailablePhasesForChannel(mockPhases, null)).toEqual([]);

        // 2. Para OBRAS_NAC: debe incluir solo fases de OBRAS_NAC, sin cerradas, y 'Visita' una sola vez
        const obrasNacPhases = getAvailablePhasesForChannel(mockPhases, 'OBRAS_NAC');
        expect(obrasNacPhases.length).toBe(2);
        expect(obrasNacPhases.map(p => p.nombre)).toEqual(['Visita', 'Presentación de propuesta']);
        expect(obrasNacPhases.some(p => p.nombre.toLowerCase().includes('cerrada'))).toBe(false);

        // 3. Para PROPIO: debe incluir solo fases de PROPIO, sin cerradas
        const propioPhases = getAvailablePhasesForChannel(mockPhases, 'PROPIO');
        expect(propioPhases.length).toBe(2);
        expect(propioPhases.map(p => p.nombre)).toEqual(['Primer contacto', 'Presentación de propuesta']);
        expect(propioPhases.some(p => p.nombre.toLowerCase().includes('cerrada'))).toBe(false);

        // 4. getEquivalentPhaseIds debe mapear IDs duplicados (56 y 97 para Visita en OBRAS_NAC)
        const equivalentVisita = getEquivalentPhaseIds(mockPhases, 56);
        expect(equivalentVisita).toContain(56);
        expect(equivalentVisita).toContain(97);

        // 5. Para PROSPECTO_PHASE_ID (-1), debe devolver [-1]
        expect(getEquivalentPhaseIds(mockPhases, PROSPECTO_PHASE_ID)).toEqual([-1]);
    });

    it('calculateTotalAmount debe sumar montos ignorando valores nulos o inválidos', async () => {
        const { calculateTotalAmount } = await import('@/lib/opportunityColumnFilterHelpers');

        const opps = [
            { amount: 1500000 },
            { amount: 2500000 },
            { amount: null },
            { amount: undefined },
            { amount: 0 },
            { amount: '3000000' as any }
        ];

        expect(calculateTotalAmount(opps)).toBe(7000000);
        expect(calculateTotalAmount([])).toBe(0);
        expect(calculateTotalAmount(null as any)).toBe(0);
    });

    it('computeProgressiveBatch debe calcular correctamente rangos from/to y hasMore para carga progresiva', async () => {
        const { computeProgressiveBatch } = await import('@/lib/opportunityColumnFilterHelpers');

        // Lote 1 de 30 elementos
        const batch1 = computeProgressiveBatch({ page: 1, pageSize: 30, totalCount: 75, receivedCount: 30 });
        expect(batch1.from).toBe(0);
        expect(batch1.to).toBe(29);
        expect(batch1.hasMore).toBe(true);

        // Lote 2 de 30 elementos (total 60)
        const batch2 = computeProgressiveBatch({ page: 2, pageSize: 30, totalCount: 75, receivedCount: 30 });
        expect(batch2.from).toBe(30);
        expect(batch2.to).toBe(59);
        expect(batch2.hasMore).toBe(true);

        // Lote 3 (últimos 15 elementos para completar los 75)
        const batch3 = computeProgressiveBatch({ page: 3, pageSize: 30, totalCount: 75, receivedCount: 15 });
        expect(batch3.from).toBe(60);
        expect(batch3.to).toBe(89);
        expect(batch3.hasMore).toBe(false);

        // Caso donde totalCount no está disponible aún pero receivedCount < pageSize
        const batchEnd = computeProgressiveBatch({ page: 1, pageSize: 30, totalCount: null, receivedCount: 12 });
        expect(batchEnd.hasMore).toBe(false);
    });

    it('debe seguir el contrato de contactos con pageSize=100 y cálculo directo de hasMore', async () => {
        const { computeProgressiveBatch, DEFAULT_OPPORTUNITIES_PAGE_SIZE } = await import('@/lib/opportunityColumnFilterHelpers');

        expect(DEFAULT_OPPORTUNITIES_PAGE_SIZE).toBe(100);

        // Simulando primera página con 100 elementos de un total de 350 (igual a useContactsServer)
        const batchPage1 = computeProgressiveBatch({ page: 1, pageSize: DEFAULT_OPPORTUNITIES_PAGE_SIZE, totalCount: 350, receivedCount: 100 });
        expect(batchPage1.from).toBe(0);
        expect(batchPage1.to).toBe(99);
        expect(batchPage1.hasMore).toBe(true);

        // Simulando cuarta página (últimos 50 elementos)
        const batchPage4 = computeProgressiveBatch({ page: 4, pageSize: DEFAULT_OPPORTUNITIES_PAGE_SIZE, totalCount: 350, receivedCount: 50 });
        expect(batchPage4.from).toBe(300);
        expect(batchPage4.to).toBe(399);
        expect(batchPage4.hasMore).toBe(false);
    });
});


