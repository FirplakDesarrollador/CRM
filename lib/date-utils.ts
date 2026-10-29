import { format, parseISO, isValid, startOfDay, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Parses a date string that might be YYYY-MM-DD or ISO.
 * If it's YYYY-MM-DD, it forces it to be treated as LOCAL time to avoid the "day before" bug.
 */
export function parseColombiaDate(dateSource: string | Date | null | undefined): Date | null {
    if (!dateSource) return null;
    if (dateSource instanceof Date) return isValid(dateSource) ? dateSource : null;

    // If it's strictly YYYY-MM-DD (10 chars), parse manually as local to avoid UTC shift
    if (typeof dateSource === 'string' && dateSource.length === 10 && dateSource.includes('-')) {
        const [year, month, day] = dateSource.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return isValid(date) ? date : null;
    }

    // Try parseISO first (for ISO strings)
    const isoDate = parseISO(dateSource);
    if (isValid(isoDate)) return isoDate;

    // Fallback to native Date constructor
    const nativeDate = new Date(dateSource);
    return isValid(nativeDate) ? nativeDate : null;
}

/**
 * Formats a date for display in Colombia (Spanish).
 * Default format: "d 'de' MMMM, yyyy"
 */
export function formatColombiaDate(dateSource: string | Date | null | undefined, formatStr = "d 'de' MMMM, yyyy"): string {
    const date = parseColombiaDate(dateSource);
    if (!date) return 'N/A';
    return format(date, formatStr, { locale: es });
}

/**
 * Formats a date for <input type="date"> (YYYY-MM-DD)
 */
export function toInputDate(dateSource: string | Date | null | undefined): string {
    const date = parseColombiaDate(dateSource);
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
}

/**
 * Formats a date for <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
 */
export function toInputDateTime(dateSource: string | Date | null | undefined): string {
    const date = parseColombiaDate(dateSource);
    if (!date) return '';
    return format(date, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Checks if a date is strictly before today (ignoring time)
 */
export function isDateOverdue(dateSource: string | Date | null | undefined): boolean {
    const date = parseColombiaDate(dateSource);
    if (!date) return false;

    const today = startOfDay(new Date());
    const compareDate = startOfDay(date);

    return isBefore(compareDate, today);
}

/**
 * Gets currently formatted date for Dashboard Header
 */
export function getFriendlyToday(): string {
    return format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Fecha y hora de creación en hora Colombia (America/Bogota), p. ej. "29/10/2026 10:37 a. m.".
 * Se arma a partir de las partes para que el texto sea igual en todos los navegadores.
 */
export function formatColombiaDateTime(dateSource: string | Date | null | undefined, fallback = '-'): string {
    if (!dateSource) return fallback;
    const date = dateSource instanceof Date ? dateSource : new Date(dateSource);
    if (!isValid(date)) return fallback;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const hour24 = Number(get('hour')) % 24;
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const period = hour24 < 12 ? 'a. m.' : 'p. m.';
    return `${get('day')}/${get('month')}/${get('year')} ${String(hour12).padStart(2, '0')}:${get('minute')} ${period}`;
}
