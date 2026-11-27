import { describe, it, expect } from 'vitest';
import { sameArrayValues } from '@/lib/listQueryHelpers';

describe('sameArrayValues', () => {
    it('considera iguales arrays nuevos con el mismo contenido', () => {
        expect(sameArrayValues([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(sameArrayValues(['a'], ['a'])).toBe(true);
        expect(sameArrayValues([], [])).toBe(true);
    });

    it('detecta cambios de contenido, longitud u orden', () => {
        expect(sameArrayValues([1, 2], [1, 3])).toBe(false);
        expect(sameArrayValues([1, 2], [1, 2, 3])).toBe(false);
        expect(sameArrayValues([1, 2], [2, 1])).toBe(false);
    });

    it('maneja null/undefined', () => {
        expect(sameArrayValues(null, null)).toBe(true);
        expect(sameArrayValues(null, [])).toBe(false);
        expect(sameArrayValues(undefined, [1])).toBe(false);
    });
});
