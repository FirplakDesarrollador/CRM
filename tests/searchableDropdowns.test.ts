import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { matchesSearchTokens } from '@/lib/utils';

const root = process.cwd();

function collectActiveUiFiles(dir: string, acc: string[] = []): string[] {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectActiveUiFiles(full, acc);
        } else if (/\.(tsx|jsx)$/.test(entry.name) && !/-isazaale\.(tsx|jsx)$/.test(entry.name)) {
            acc.push(full);
        }
    }
    return acc;
}

describe('Cobertura integral de desplegables con búsqueda', () => {
    it('no deben existir elementos <select> nativos sin función de búsqueda en la UI activa', () => {
        const files = [
            ...collectActiveUiFiles(path.join(root, 'app')),
            ...collectActiveUiFiles(path.join(root, 'components')),
            ...collectActiveUiFiles(path.join(root, 'features')),
        ];

        const offenders: string[] = [];
        for (const file of files) {
            const content = readFileSync(file, 'utf8');
            const lines = content.split(/\r?\n/);
            lines.forEach((line, idx) => {
                if (/<select(?:\s|>|$)/i.test(line)) {
                    const rel = path.relative(root, file).replace(/\\/g, '/');
                    offenders.push(`${rel}:${idx + 1}`);
                }
            });
        }

        expect(offenders).toEqual([]);
    });

    it('AccountForm y CreateAccountWizard usan ParentAccountCombobox con búsqueda para Cuenta Principal', () => {
        const accountForm = readFileSync(path.join(root, 'components', 'cuentas', 'AccountForm.tsx'), 'utf8');
        const createAccountWizard = readFileSync(path.join(root, 'app', 'cuentas', 'nueva', 'CreateAccountWizard.tsx'), 'utf8');

        expect(accountForm).toMatch(/ParentAccountCombobox/);
        expect(createAccountWizard).toMatch(/ParentAccountCombobox/);
    });

    it('SearchableSelect y MultiSelect utilizan filtrado controlado insensible a acentos y multi-token', () => {
        const searchableSelect = readFileSync(path.join(root, 'components', 'ui', 'SearchableSelect.tsx'), 'utf8');
        const multiSelect = readFileSync(path.join(root, 'components', 'ui', 'MultiSelect.tsx'), 'utf8');

        expect(searchableSelect).toMatch(/matchesSearchTokens/);
        expect(searchableSelect).toMatch(/shouldFilter=\{false\}/);
        expect(multiSelect).toMatch(/matchesSearchTokens/);
        expect(multiSelect).toMatch(/shouldFilter=\{false\}/);
    });

    it('FloatingColumnFilterPopover usa búsqueda normalizada sin distinción de tildes', () => {
        const popover = readFileSync(
            path.join(root, 'components', 'oportunidades', 'FloatingColumnFilterPopover.tsx'),
            'utf8'
        );
        expect(popover).toMatch(/matchesSearchTokens/);
    });

    it('matchesSearchTokens encuentra opciones con tildes, orden invertido y NIT', () => {
        expect(matchesSearchTokens(['Medellín', 'Antioquia'], 'medellin')).toBe(true);
        expect(matchesSearchTokens(['Constructora Bolívar S.A.', '900123456-7'], 'bolivar 900123')).toBe(true);
        expect(matchesSearchTokens(['Distribución Nacional', 'DIST_NAC'], 'nacional distribucion')).toBe(true);
        expect(matchesSearchTokens(['Bogotá D.C.'], 'cali')).toBe(false);
    });
});
