import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isToolbarOwnedTableColumn } from '@/lib/tableFilterPolicy';

const root = process.cwd();

describe('Política de filtros no duplicados (barra vs columna)', () => {
    it('marca como de barra los filtros de cuentas que ya existen en AccountFilters / UserPicker', () => {
        expect(isToolbarOwnedTableColumn('cuentas', 'canal_id')).toBe(true);
        expect(isToolbarOwnedTableColumn('cuentas', 'tipo')).toBe(true);
        expect(isToolbarOwnedTableColumn('cuentas', 'vendedor')).toBe(true);
        expect(isToolbarOwnedTableColumn('cuentas', 'nivel')).toBe(true);
        expect(isToolbarOwnedTableColumn('cuentas', 'creacion')).toBe(true);
        expect(isToolbarOwnedTableColumn('cuentas', 'ciudad')).toBe(false);
        expect(isToolbarOwnedTableColumn('cuentas', 'nombre')).toBe(false);
    });

    it('marca como de barra cuenta y principal en contactos', () => {
        expect(isToolbarOwnedTableColumn('contactos', 'cuenta')).toBe(true);
        expect(isToolbarOwnedTableColumn('contactos', 'principal')).toBe(true);
        expect(isToolbarOwnedTableColumn('contactos', 'email')).toBe(false);
        expect(isToolbarOwnedTableColumn('contactos', 'cargo')).toBe(false);
    });

    it('la barra avanzada de oportunidades no vuelve a pintar Creación ni Cierre (ya están en QuickDateFilter y en la columna)', () => {
        const filters = readFileSync(
            path.join(root, 'components', 'oportunidades', 'OpportunityFilters.tsx'),
            'utf8'
        );
        expect(filters).not.toMatch(/>Creación:</);
        expect(filters).not.toMatch(/>Cierre:</);
        expect(filters).not.toMatch(/startClosingDate: val/);
    });

    it('cuentas y contactos cierran el menú nativo de Handsontable en columnas ya cubiertas por la barra', () => {
        const cuentas = readFileSync(path.join(root, 'app', 'cuentas', 'page.tsx'), 'utf8');
        const contactos = readFileSync(path.join(root, 'app', 'contactos', 'page.tsx'), 'utf8');
        expect(cuentas).toContain("isToolbarOwnedTableColumn('cuentas'");
        expect(cuentas).toContain('beforeDropdownMenuShow');
        expect(contactos).toContain("isToolbarOwnedTableColumn('contactos'");
        expect(contactos).toContain('beforeDropdownMenuShow');
    });
});
