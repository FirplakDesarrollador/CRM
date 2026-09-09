import { describe, it, expect } from 'vitest';
import { formatOpportunityAmount } from '../lib/utils';

describe('formatOpportunityAmount', () => {
    it('debe formatear montos con punto para miles y coma para decimales (es-CO)', () => {
        expect(formatOpportunityAmount(152266785.2, 'COP')).toBe('COP 152.266.785,2');
        expect(formatOpportunityAmount(152266785, 'COP')).toBe('COP 152.266.785');
    });

    it('debe formatear montos con diferentes monedas como USD', () => {
        expect(formatOpportunityAmount(5000.5, 'USD')).toBe('USD 5.000,5');
    });

    it('debe manejar valores nulos o 0 adecuadamente', () => {
        expect(formatOpportunityAmount(0, 'COP')).toBe('COP 0');
        expect(formatOpportunityAmount(null, 'COP')).toBe('COP 0');
        expect(formatOpportunityAmount(undefined, 'COP')).toBe('COP 0');
    });
});
