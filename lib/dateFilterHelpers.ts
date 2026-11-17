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


/**
 * Devuelve la parte YYYY-MM-DD de una fecha "solo día" (columna date de Postgres) sin convertirla a UTC.
 * new Date('2026-11-30') se interpreta como medianoche UTC y en Colombia (UTC-5) se ve como el día anterior.
 */
export function toDateOnly(value: string | null | undefined): string | null {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Formatea una fecha "solo día" YYYY-MM-DD como DD/MM/YYYY sin pasar por Date (sin corrimiento de zona). */
export function formatDateOnlyDMY(value: string | null | undefined): string | null {
    const d = toDateOnly(value);
    if (!d) return null;
    const [y, mo, da] = d.split('-');
    return `${da}/${mo}/${y}`;
}

/** Indica si una fecha "solo día" está en el rango [start, end] (ambos inclusive, YYYY-MM-DD). */
export function isDateOnlyInRange(value: string | null | undefined, start: string | null | undefined, end: string | null | undefined): boolean {
    const d = toDateOnly(value);
    if (!d) return false;
    const s = toDateOnly(start);
    const e = toDateOnly(end);
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
}

/** Una fecha "solo día" está vencida si es anterior al día de hoy (hora local). */
export function isDateOnlyOverdue(value: string | null | undefined, now: Date = new Date()): boolean {
    const d = toDateOnly(value);
    if (!d) return false;
    return d < formatLocalDateToYMD(now);
}
