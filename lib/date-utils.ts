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
