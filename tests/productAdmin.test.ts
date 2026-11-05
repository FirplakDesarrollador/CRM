import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/stores/useUserStore', () => ({ useUserStore: { getState: () => ({ user: null }) } }));

import { formatPriceInput, parsePriceInput, validateProductForm, emptyProductForm, normalizeArticleCode, updateProduct } from '@/lib/productAdmin';

describe('parsePriceInput', () => {
    it('interpreta formatos colombianos y simples', () => {
        expect(parsePriceInput('150000')).toBe(150000);
        expect(parsePriceInput('150.000')).toBe(150000);
        expect(parsePriceInput('1.500.000')).toBe(1500000);
        expect(parsePriceInput('$ 1.500.000,50')).toBe(1500000.5);
        expect(parsePriceInput('150,000')).toBe(150000);
        expect(parsePriceInput('45.5')).toBe(45.5);
        expect(parsePriceInput('45,50')).toBe(45.5);
        expect(parsePriceInput('')).toBe(0);
    });
    it('rechaza texto no numérico', () => {
        expect(parsePriceInput('abc')).toBeNaN();
        expect(parsePriceInput('12a')).toBeNaN();
    });
});

describe('formatPriceInput (ida y vuelta)', () => {
    it('formatea y se vuelve a leer igual', () => {
        for (const v of [0, 1, 45.5, 45.125, 0.125, 999, 1000, 4070.1, 10582268.91, 12592900, 1234.567]) {
            expect(parsePriceInput(formatPriceInput(v))).toBeCloseTo(v, 6);
        }
        expect(formatPriceInput(12592900)).toBe('12.592.900');
        expect(formatPriceInput(10582268.91)).toBe('10.582.268,91');
        expect(formatPriceInput(null)).toBe('');
    });
    it('0,125 es decimal', () => {
        expect(parsePriceInput('0,125')).toBe(0.125);
    });
});

describe('validateProductForm', () => {
    const base = () => ({ ...emptyProductForm(), numero_articulo: ' vhem05-0009-000-0100 ', descripcion: 'Mueble prueba', lista_base_cop: '150.000' });

    it('normaliza el código y arma el payload', () => {
        const { errors, payload } = validateProductForm(base(), 'create');
        expect(errors).toEqual({});
        expect(payload?.numero_articulo).toBe('VHEM05-0009-000-0100');
        expect(payload?.lista_base_cop).toBe(150000);
        expect(payload?.precio_feria).toBe(0);
        expect(payload?.planta).toBeNull();
    });

    it('exige código, descripción y al menos un precio > 0', () => {
        const { errors, payload } = validateProductForm(emptyProductForm(), 'create');
        expect(payload).toBeNull();
        expect(errors.numero_articulo).toBeTruthy();
        expect(errors.descripcion).toBeTruthy();
        expect(errors.precios).toBeTruthy();
    });

    it('rechaza precios negativos o inválidos y códigos con espacios', () => {
        const { errors } = validateProductForm({ ...base(), numero_articulo: 'AB C', lista_base_cop: '-5', precio_feria: 'x' }, 'create');
        expect(errors.numero_articulo).toBeTruthy();
        expect(errors.lista_base_cop).toBeTruthy();
        expect(errors.precio_feria).toBeTruthy();
    });

    it('en edición no valida el código', () => {
        const { errors } = validateProductForm({ ...base(), numero_articulo: '' }, 'edit');
        expect(errors.numero_articulo).toBeUndefined();
    });

    it('normalizeArticleCode', () => {
        expect(normalizeArticleCode('  abc-1 ')).toBe('ABC-1');
    });
});

describe('permisos', () => {
    it('un usuario no admin no puede guardar', async () => {
        await expect(updateProduct('x', { descripcion: 'a', planta: null, familia: null, lista_base_cop: 1, distribuidor_pvp_iva: 0, pvp_sin_iva: 0, lista_base_obras: 0, lista_base_exportaciones: 0, precio_feria: 0 })).rejects.toThrow(/administradores/);
    });
});
