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
 * Convierte una fecha YYYY-MM-DD al inicio exacto de ese día (00:00:00.000) en la zona horaria local en formato ISO UTC.
 */
export function toStartOfDayISO(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : String(dateStr).trim();
    const parts = cleanDate.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
        const [year, month, day] = parts;
        return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
    }
    return dateStr;
}

/**
 * Convierte una fecha YYYY-MM-DD al final exacto de ese día (23:59:59.999) en la zona horaria local en formato ISO UTC.
 * Evita que las oportunidades creadas durante el día se excluyan por desajustes de zona horaria (UTC vs UTC-5 Colombia).
 */
export function toEndOfDayISO(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : String(dateStr).trim();
    const parts = cleanDate.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
        const [year, month, day] = parts;
        return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
    }
    return dateStr;
}

/**
 * Formatea una fecha local a YYYY-MM-DD respetando la zona horaria local del navegador/dispositivo.
 */
export function formatLocalDateToYMD(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Presets rápidos de fechas para el CRM
 */
export const DATE_FILTER_PRESETS: DateRangePreset[] = [
    {
        id: 'up_to_today',
        label: 'Hasta la fecha (Anteriores a hoy)',
        getRange: (now = new Date()) => {
            const todayStr = formatLocalDateToYMD(now);
            return { startDate: null, endDate: todayStr };
        }
    },
    {
        id: 'today',
        label: 'Hoy',
        getRange: (now = new Date()) => {
            const todayStr = formatLocalDateToYMD(now);
            return { startDate: todayStr, endDate: todayStr };
        }
    },
    {
        id: 'last_7_days',
        label: 'Últimos 7 días',
        getRange: (now = new Date()) => {
            const todayStr = formatLocalDateToYMD(now);
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            return { startDate: formatLocalDateToYMD(d), endDate: todayStr };
        }
    },
    {
        id: 'last_30_days',
        label: 'Últimos 30 días',
        getRange: (now = new Date()) => {
            const todayStr = formatLocalDateToYMD(now);
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            return { startDate: formatLocalDateToYMD(d), endDate: todayStr };
        }
    },
    {
        id: 'this_month',
        label: 'Este mes',
        getRange: (now = new Date()) => {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const startOfMonth = `${year}-${month}-01`;
            const todayStr = formatLocalDateToYMD(now);
            return { startDate: startOfMonth, endDate: todayStr };
        }
    },
    {
        id: 'this_year',
        label: 'Año actual',
        getRange: (now = new Date()) => {
            const year = now.getFullYear();
            const startOfYear = `${year}-01-01`;
            const todayStr = formatLocalDateToYMD(now);
            return { startDate: startOfYear, endDate: todayStr };
        }
    },
    {
        id: 'all',
        label: 'Todas las fechas (Histórico completo)',
        getRange: () => ({ startDate: null, endDate: null })
    }
];

