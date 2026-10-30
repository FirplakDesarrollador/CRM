import { describe, it, expect } from 'vitest';
import { formatColombiaDateTime } from '@/lib/date-utils';

describe('formatColombiaDateTime (columna Creación)', () => {
    it('muestra fecha y hora en hora Colombia (UTC-5)', () => {
        expect(formatColombiaDateTime('2026-10-29T15:37:00Z')).toBe('29/10/2026 10:37 a. m.');
        expect(formatColombiaDateTime('2026-10-29T18:25:00+00:00')).toBe('29/10/2026 01:25 p. m.');
    });

    it('cambia de día según la hora Colombia, no UTC', () => {
        expect(formatColombiaDateTime('2026-10-30T02:10:00Z')).toBe('29/10/2026 09:10 p. m.');
    });

    it('maneja mediodía y medianoche', () => {
        expect(formatColombiaDateTime('2026-10-29T17:00:00Z')).toBe('29/10/2026 12:00 p. m.');
        expect(formatColombiaDateTime('2026-10-29T05:05:00Z')).toBe('29/10/2026 12:05 a. m.');
    });

    it('devuelve "-" si no hay fecha válida', () => {
        expect(formatColombiaDateTime(null)).toBe('-');
        expect(formatColombiaDateTime(undefined)).toBe('-');
        expect(formatColombiaDateTime('no-es-fecha')).toBe('-');
    });
});
