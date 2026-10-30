import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Cotizaciones / Quote Editor Responsive Layout', () => {
    const pagePath = path.join(root, 'app', 'oportunidades', '[id]', 'cotizaciones', '[quoteId]', 'page.tsx');
    const headerPath = path.join(root, 'components', 'ui', 'DetailHeader.tsx');

    it('archivos clave del editor de cotizaciones deben existir', () => {
        expect(existsSync(pagePath), 'page.tsx de cotizaciones debe existir').toBe(true);
        expect(existsSync(headerPath), 'DetailHeader.tsx debe existir').toBe(true);
    });

    it('DetailHeader debe incluir truncate y min-w-0 para evitar desborde horizontal en móviles', () => {
        const headerContent = readFileSync(headerPath, 'utf8');
        expect(headerContent).toContain('min-w-0');
        expect(headerContent).toMatch(/<h1[^>]*truncate/);
    });

    it('QuoteEditorPage debe incluir contenedor con overflow-x-hidden y ancho completo responsivo', () => {
        const pageContent = readFileSync(pagePath, 'utf8');
        expect(pageContent).toContain('overflow-x-hidden');
    });

    it('QuoteItemsEditor debe tener ítems con controles responsivos y botón de eliminación adaptado a móvil', () => {
        const pageContent = readFileSync(pagePath, 'utf8');
        // Debe tener diseño adaptable sin filas rígidas sin flex-wrap o con eliminación móvil dedicada
        expect(pageContent).toMatch(/md:hidden[^>]*title=["']Eliminar producto["']/);
        // Debe tener padding responsivo en las tarjetas de productos
        expect(pageContent).toMatch(/p-3\.5 sm:p-4|p-4 sm:p-6/);
    });

    it('el buscador de productos debe tener padding derecho suficiente para el botón Ítem Manual', () => {
        const pageContent = readFileSync(pagePath, 'utf8');
        expect(pageContent).toMatch(/pr-24|pr-28/);
    });
});
