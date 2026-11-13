import { describe, expect, it } from 'vitest';
import {
    appendNote,
    buildDiscountExceptionNote,
    canAuthorizeDiscountException,
    resolveDiscountChange,
    shouldKeepDiscountOnQtyChange
} from '@/lib/discountExceptions';

describe('Excepción de descuento canal constructor (OBRAS_NAC)', () => {
    it('dentro del máximo no cambia nada en ningún canal', () => {
        expect(resolveDiscountChange({ requestedPct: 10, maxPct: 15, channel: 'DIST_NAC', role: 'VENDEDOR' })).toEqual({ kind: 'ok', pct: 10 });
        expect(resolveDiscountChange({ requestedPct: 15, maxPct: 15, channel: 'OBRAS_NAC', role: 'VENDEDOR' })).toEqual({ kind: 'ok', pct: 15 });
    });

    it('otros canales siguen recortando al máximo para cualquier rol', () => {
        for (const channel of ['DIST_NAC', 'DIST_INT', 'OBRAS_INT', 'PROPIO', 'FERIA']) {
            for (const role of ['VENDEDOR', 'COORDINADOR', 'ADMIN']) {
                expect(resolveDiscountChange({ requestedPct: 30, maxPct: 20, channel, role }))
                    .toEqual({ kind: 'capped', pct: 20, requestedPct: 30, maxPct: 20, canRequest: false });
            }
        }
    });

    it('en Obras Nacional ADMIN/COORDINADOR deben autorizar con motivo', () => {
        expect(resolveDiscountChange({ requestedPct: 30, maxPct: 20, channel: 'OBRAS_NAC', role: 'ADMIN' }))
            .toEqual({ kind: 'needs_authorization', requestedPct: 30, maxPct: 20 });
        expect(canAuthorizeDiscountException('COORDINADOR', 'OBRAS_NAC')).toBe(true);
        expect(canAuthorizeDiscountException('VENDEDOR', 'OBRAS_NAC')).toBe(false);
        expect(canAuthorizeDiscountException('ADMIN', 'DIST_NAC')).toBe(false);
    });

    it('en Obras Nacional el asesor queda en el máximo pero puede solicitar', () => {
        expect(resolveDiscountChange({ requestedPct: 30, maxPct: 20, channel: 'OBRAS_NAC', role: 'VENDEDOR' }))
            .toEqual({ kind: 'capped', pct: 20, requestedPct: 30, maxPct: 20, canRequest: true });
    });

    it('la cuenta con ignorar_limites_descuento sigue sin límite (comportamiento previo)', () => {
        expect(resolveDiscountChange({ requestedPct: 40, maxPct: 20, channel: 'DIST_NAC', role: 'VENDEDOR', ignorarLimites: true }))
            .toEqual({ kind: 'ok', pct: 40 });
    });

    it('al cambiar cantidad conserva solo excepciones ya autorizadas en Obras', () => {
        expect(shouldKeepDiscountOnQtyChange({ channel: 'OBRAS_NAC', currentDiscountPct: 30, previousMaxPct: 20 })).toBe(true);
        expect(shouldKeepDiscountOnQtyChange({ channel: 'OBRAS_NAC', currentDiscountPct: 10, previousMaxPct: 20 })).toBe(false);
        expect(shouldKeepDiscountOnQtyChange({ channel: 'DIST_NAC', currentDiscountPct: 30, previousMaxPct: 20 })).toBe(false);
        expect(shouldKeepDiscountOnQtyChange({ channel: 'DIST_NAC', ignorarLimites: true })).toBe(true);
    });

    it('la nota de auditoría deja producto, porcentaje, máximo, usuario y motivo', () => {
        const note = buildDiscountExceptionNote({
            type: 'AUTORIZADA', productLabel: 'Lavamanos X', requestedPct: 30, maxPct: 20,
            userName: 'Ana Pérez', reason: ' Proyecto 200 unidades ', date: new Date('2026-10-28T15:00:00Z')
        });
        expect(note).toContain('[Excepción de descuento AUTORIZADA]');
        expect(note).toContain('Lavamanos X: 30% (máx. 20%)');
        expect(note).toContain('Autorizó: Ana Pérez');
        expect(note).toContain('Motivo: Proyecto 200 unidades');
        expect(appendNote('Nota previa', note)).toBe(`Nota previa\n${note}`);
        expect(appendNote('', note)).toBe(note);
    });
});
