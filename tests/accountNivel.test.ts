import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAccountNivelBadge } from '@/lib/accountNivel';

describe('Nivel de cliente (CRM_Cuentas.nivel_premium)', () => {
    it('muestra Premium, Destacado y Activo con el estilo de la ficha y el listado de cuentas', () => {
        const premium = resolveAccountNivelBadge('PREMIUM');
        expect(premium.label).toBe('Premium');
        expect(premium.className).toContain('bg-amber-100');
        expect(premium.className).toContain('text-amber-700');
        expect(premium.className).toContain('border-amber-200');

        const destacado = resolveAccountNivelBadge('DESTACADO');
        expect(destacado.label).toBe('Destacado');
        expect(destacado.className).toContain('bg-slate-100');
        expect(destacado.className).toContain('text-slate-700');

        const activo = resolveAccountNivelBadge('activo');
        expect(activo.label).toBe('Activo');
        expect(activo.className).toContain('bg-orange-50');
        expect(activo.className).toContain('text-orange-700');
        expect(activo.className).toContain('border-orange-200');
    });

    it('usa Regular cuando la cuenta cargada no tiene nivel, igual que las tarjetas de Cuentas', () => {
        for (const empty of [null, undefined, '', '   ']) {
            const badge = resolveAccountNivelBadge(empty);
            expect(badge.label).toBe('Regular');
            expect(badge.className).toContain('bg-slate-100');
            expect(badge.className).toContain('text-slate-700');
        }
    });

    it('conserva un valor desconocido en lugar de inventar una clasificación', () => {
        const badge = resolveAccountNivelBadge('  VIP  ');
        expect(badge.label).toBe('VIP');
        expect(badge.className).toContain('bg-slate-100');
    });

    it('el detalle de oportunidad pinta el badge junto al nombre con el nivel de la cuenta en Dexie', () => {
        const detail = readFileSync(path.join(process.cwd(), 'app', 'oportunidades', '[id]', 'page.tsx'), 'utf8');
        const nameAt = detail.indexOf('Nombre / Razón Social');
        const nitAt = detail.indexOf('>NIT<');
        const card = detail.slice(nameAt, nitAt);
        expect(nameAt).toBeGreaterThan(-1);
        expect(nitAt).toBeGreaterThan(nameAt);
        expect(card).toContain('<AccountNivelBadge');
        expect(card).toContain('nivel={account.nivel_premium}');

        const badge = readFileSync(path.join(process.cwd(), 'components', 'cuentas', 'AccountNivelBadge.tsx'), 'utf8');
        expect(badge).toContain('data-testid="account-nivel-badge"');
        expect(badge).toContain('resolveAccountNivelBadge');
    });
});
