import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildAccountTokenOrFilter,
    resolveAccountComboboxLabel,
    sanitizePostgrestToken,
} from '../lib/accountSearchHelpers';

describe('Buscador de cuentas en móvil (AccountCombobox + useAccountsServer + CreateActivityModal)', () => {
    it('construye filtros de servidor insensibles a tildes y seguros ante caracteres especiales de PostgREST', () => {
        const filter = buildAccountTokenOrFilter('construccion', []);
        expect(filter).toContain('nombre.imatch.');
        expect(filter).toContain('ciudad.imatch.');
        expect(filter).toContain('nit_base.ilike.%construccion%');
        expect(filter).toContain('nit.ilike.%construccion%');

        expect(sanitizePostgrestToken('Ferreteria, (Lopez)')).toBe('Ferreteria Lopez');

        const phoneFilter = buildAccountTokenOrFilter('3001234567', ['acc-phone-1']);
        expect(phoneFilter).toContain('id.in.(acc-phone-1)');
        expect(phoneFilter).toContain('telefono.ilike.%3001234567%');
    });

    it('no deja el botón del combobox atascado en "Cargando..." cuando la búsqueda de etiqueta termina sin resultados', () => {
        expect(resolveAccountComboboxLabel({
            value: '',
            accounts: [],
            resolvedName: '',
            initialLabel: undefined,
            isResolving: false,
        })).toBe('Seleccione una cuenta...');

        expect(resolveAccountComboboxLabel({
            value: 'acc-1',
            accounts: [{ id: 'acc-1', nombre: 'Constructora Norte' }],
            resolvedName: '',
            initialLabel: undefined,
            isResolving: true,
        })).toBe('Constructora Norte');

        expect(resolveAccountComboboxLabel({
            value: 'acc-missing',
            accounts: [],
            resolvedName: '',
            initialLabel: undefined,
            isResolving: true,
        })).toBe('Cargando...');

        expect(resolveAccountComboboxLabel({
            value: 'acc-missing',
            accounts: [],
            resolvedName: '',
            initialLabel: undefined,
            isResolving: false,
        })).toBe('Cuenta seleccionada');
    });

    it('AccountCombobox y AccountSelector ignoran filtros persistidos de /cuentas y usan consulta ligera sin vista pesada ni outbox', () => {
        const root = process.cwd();
        const comboboxSrc = readFileSync(path.join(root, 'components/accounts/AccountCombobox.tsx'), 'utf8');
        const selectorSrc = readFileSync(path.join(root, 'components/contactos/AccountSelector.tsx'), 'utf8');
        const hookSrc = readFileSync(path.join(root, 'lib/hooks/useAccountsServer.ts'), 'utf8');

        expect(comboboxSrc).toContain('ignorePersistedFilters: true');
        expect(comboboxSrc).toContain('lightweight: true');
        expect(selectorSrc).toContain('ignorePersistedFilters: true');
        expect(selectorSrc).toContain('lightweight: true');

        expect(hookSrc).toContain('ignorePersistedFilters');
        expect(hookSrc).toContain('lightweight');
        expect(hookSrc).toContain('requestIdRef');
        expect(hookSrc).toContain('buildAccountTokenOrFilter');
    });

    it('AccountCombobox, OpportunityCombobox y CreateActivityModal evitan solapamiento y recorte en viewport móvil', () => {
        const root = process.cwd();
        const comboboxSrc = readFileSync(path.join(root, 'components/accounts/AccountCombobox.tsx'), 'utf8');
        const oppComboboxSrc = readFileSync(path.join(root, 'components/opportunities/OpportunityCombobox.tsx'), 'utf8');
        const modalSrc = readFileSync(path.join(root, 'components/activities/CreateActivityModal.tsx'), 'utf8');

        // Ancho válido en Tailwind v4 + colisiones activas + z-index superior al modal
        expect(comboboxSrc).toContain('w-[var(--radix-popover-trigger-width)]');
        expect(comboboxSrc).not.toContain('w-[--radix-popover-trigger-width]');
        expect(comboboxSrc).toContain('avoidCollisions={true}');
        expect(comboboxSrc).not.toContain('avoidCollisions={false}');
        expect(comboboxSrc).toContain('z-[80]');
        expect(comboboxSrc).toContain('text-base sm:text-sm');

        expect(oppComboboxSrc).toContain('w-[var(--radix-popover-trigger-width)]');
        expect(oppComboboxSrc).toContain('avoidCollisions={true}');
        expect(oppComboboxSrc).toContain('z-[80]');

        // El modal debe quedar por encima de MobileNav (z-50) para no tapar el footer ni el buscador
        expect(modalSrc).toContain('z-[60]');
    });
});
