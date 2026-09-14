import { computeOpportunityActivitySummary } from './opportunityActivities';

export const OPPORTUNITY_TABLE_COLUMN_KEYS = [
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
    'valor',
    'cierre',
    'vendedor'
];

export interface OpportunityHotRow {
    id: string;
    account_id?: string | null;
    nombre: string;
    cuenta: string;
    actividades: string;
    actividades_status: 'none' | 'overdue' | 'scheduled' | 'completed';
    pais: string;
    ciudad: string;
    canal: string;
    origen: string;
    fase: string;
    estado: string;
    creada: string;
    valor: number;
    cierre: string;
    cierre_overdue: boolean;
    vendedor: string;
}

export interface OpportunityInput {
    id: string;
    account_id?: string | null;
    nombre?: string | null;
    amount?: number | null;
    account?: {
        id?: string;
        nombre?: string | null;
        ciudad?: string | null;
        canal_id?: string | null;
        pais_id?: number | null;
        pais?: string | null;
    } | null;
    actividades?: Parameters<typeof computeOpportunityActivitySummary>[0];
    activity_summary?: ReturnType<typeof computeOpportunityActivitySummary> | null;
    origen_oportunidad?: string | null;
    fase_data?: { nombre?: string | null } | null;
    estado_data?: { nombre?: string | null } | null;
    created_at?: string | null;
    fecha_cierre_estimada?: string | null;
    vendedor?: { full_name?: string | null } | null;
}

export interface HotInstanceLike {
    toPhysicalRow?: (visualRow: number) => number;
    getSourceDataAtRow?: (physicalRow: number) => unknown;
}

/**
 * Mapea una oportunidad a una fila para Handsontable.
 * Es crítico que todos los campos asignados a columnas sean valores primitivos (strings/numbers)
 * para garantizar que los filtros internos (filter_by_value) muestren textos legibles
 * y el input de búsqueda (Search) funcione correctamente, evitando '[object Object]'.
 */
export function buildOpportunityHotRow(
    opp: OpportunityInput,
    countryMap: Record<number, string> = {}
): OpportunityHotRow {
    const actSummary = opp.activity_summary || computeOpportunityActivitySummary(opp.actividades);
    const countryName = opp.account?.pais_id
        ? (countryMap[opp.account.pais_id] || 'Colombia')
        : (opp.account?.pais || 'Colombia');

    return {
        id: opp.id,
        account_id: opp.account_id || opp.account?.id || null,
        nombre: opp.nombre || 'Sin nombre',
        cuenta: opp.account?.nombre || 'Sin cuenta',
        actividades: actSummary.label || 'Sin actividad',
        actividades_status: actSummary.status || 'none',
        pais: countryName,
        ciudad: opp.account?.ciudad || 'Sin ciudad',
        canal: opp.account?.canal_id || '-',
        origen: opp.origen_oportunidad || '-',
        fase: opp.fase_data?.nombre || 'Pros.',
        estado: opp.estado_data?.nombre || 'Abierta',
        creada: opp.created_at
            ? new Date(opp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '-',
        valor: opp.amount || 0,
        cierre: opp.fecha_cierre_estimada
            ? new Date(opp.fecha_cierre_estimada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
            : '-',
        cierre_overdue: opp.fecha_cierre_estimada
            ? new Date(opp.fecha_cierre_estimada) < new Date()
            : false,
        vendedor: opp.vendedor?.full_name || 'Sin asignar'
    };
}

/**
 * Resuelve la fila física correspondiente considerando filtros u ordenamientos de Handsontable.
 * Evita que clics en filas o custom renderers operen sobre la fila equivocada tras filtrar.
 */
export function resolveHotRowData<T>(
    hotInstance: unknown,
    visualRow: number,
    fallbackData: T[] = []
): T | undefined {
    const instance = hotInstance as HotInstanceLike | null | undefined;
    if (instance && typeof instance.toPhysicalRow === 'function') {
        const physicalRow = instance.toPhysicalRow(visualRow);
        if (physicalRow >= 0 && typeof instance.getSourceDataAtRow === 'function') {
            const data = instance.getSourceDataAtRow(physicalRow);
            if (data) return data as T;
        }
        if (physicalRow >= 0 && fallbackData[physicalRow]) {
            return fallbackData[physicalRow];
        }
    }
    return fallbackData[visualRow];
}
