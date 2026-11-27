import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Barra de herramientas de oportunidades - Responsividad y buscador', () => {
    const pagePath = path.join(root, 'app', 'oportunidades', 'page.tsx');

    it('el archivo page.tsx de oportunidades debe existir', () => {
        expect(existsSync(pagePath), 'page.tsx de oportunidades debe existir').toBe(true);
    });

    it('el buscador de oportunidades debe tener un ancho mínimo explícito para evitar colapsar a 42px', () => {
        const pageContent = readFileSync(pagePath, 'utf8');
        // Debe evitar que flex-1 comprima el buscador a un cuadro minúsculo al agregar filtros
        expect(pageContent).toMatch(/relative\s+flex-1\s+min-w-\[(?:180|200|220)px\]/);
    });

    it('el contenedor de controles de la barra debe adaptarse a pantallas de laptop (1280px-1536px) sin apretar los controles', () => {
        const pageContent = readFileSync(pagePath, 'utf8');
        // El toolbar principal no debe forzar xl:flex-row a 1280px porque 5 pestañas + 4 filtros + buscador superan los 1000px disponibles
        expect(pageContent).toMatch(/2xl:flex-row/);
    });

    it('la barra de controles debe tener estructura adaptable y botón de limpiar búsqueda cuando hay texto', () => {
        const pageContent = readFileSync(pagePath, 'utf8');
        // Debe permitir limpiar la búsqueda fácilmente
        expect(pageContent).toContain('setInputValue("")');
    });
});
