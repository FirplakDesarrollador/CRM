/**
 * Helpers para filtros de fecha en la tabla de Oportunidades y sincronización con el servidor Supabase.
 */

export interface DateRangePreset {
    id: string;
    label: string;
    getRange: (now?: Date) => { startDate: string | null; endDate: string | null };
}

/**
 * Convierte una fecha DD/MM/YYYY (formato visual de Handsontable) a YYYY-MM-DD (formato ISO para Supabase).
 */
export function parseHandsontableDate(dateStr: string | null | undefined): string | null {
    if (!dateStr || dateStr === '-') return null;
    const trimmed = String(dateStr).trim();
    const parts = trimmed.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year && year.length === 4) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
    // Si ya viene como YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }
    return null;
}

/**
 * Presets rápidos de fechas para el CRM
 */
export const DATE_FILTER_PRESETS: DateRangePreset[] = [
    {
        id: 'up_to_today',
        label: 'Hasta la fecha (Anteriores a hoy)',
        getRange: (now = new Date()) => {
            const todayStr = now.toISOString().split('T')[0];
            return { startDate: null, endDate: todayStr };
        }
    },
    {
        id: 'today',
        label: 'Hoy',
        getRange: (now = new Date()) => {
            const todayStr = now.toISOString().split('T')[0];
            return { startDate: todayStr, endDate: todayStr };
        }
    },
    {
        id: 'last_7_days',
        label: 'Últimos 7 días',
        getRange: (now = new Date()) => {
            const todayStr = now.toISOString().split('T')[0];
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
        }
    },
    {
        id: 'last_30_days',
        label: 'Últimos 30 días',
        getRange: (now = new Date()) => {
            const todayStr = now.toISOString().split('T')[0];
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
        }
    },
    {
        id: 'this_month',
        label: 'Este mes',
        getRange: (now = new Date()) => {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const startOfMonth = `${year}-${month}-01`;
            const todayStr = now.toISOString().split('T')[0];
            return { startDate: startOfMonth, endDate: todayStr };
        }
    },
    {
        id: 'this_year',
        label: 'Año actual',
        getRange: (now = new Date()) => {
            const year = now.getFullYear();
            const startOfYear = `${year}-01-01`;
            const todayStr = now.toISOString().split('T')[0];
            return { startDate: startOfYear, endDate: todayStr };
        }
    },
    {
        id: 'all',
        label: 'Todas las fechas (Histórico completo)',
        getRange: () => ({ startDate: null, endDate: null })
    }
];
