import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeDateToInput, mapPedidoServerPayload } from '../lib/pedidoHelpers';

const root = process.cwd();

describe('Persistencia y normalización de formularios de pedidos', () => {
    describe('normalizeDateToInput', () => {
        it('convierte fechas en formato SAP DD/MM/YYYY a YYYY-MM-DD para input HTML5', () => {
            expect(normalizeDateToInput('18/12/2025')).toBe('2025-12-18');
            expect(normalizeDateToInput('05/01/2026')).toBe('2026-01-05');
        });

        it('mantiene fechas ya en formato YYYY-MM-DD', () => {
            expect(normalizeDateToInput('2026-09-20')).toBe('2026-09-20');
        });

        it('extrae YYYY-MM-DD de strings ISO con timestamp', () => {
            expect(normalizeDateToInput('2026-09-20T14:30:00.000Z')).toBe('2026-09-20');
        });

        it('devuelve cadena vacía si el valor es nulo, indefinido o inválido', () => {
            expect(normalizeDateToInput(null)).toBe('');
            expect(normalizeDateToInput(undefined)).toBe('');
            expect(normalizeDateToInput('')).toBe('');
            expect(normalizeDateToInput('no-es-fecha')).toBe('');
        });
    });

    describe('mapPedidoServerPayload', () => {
        it('sincroniza bidireccionalmente fecha_entrega y fecha_minima_requerida hacia EXTRA_ y nativo', () => {
            const result = mapPedidoServerPayload({
                uuid_generado: 'ped-1',
                fecha_entrega: '2026-09-25'
            });

            expect(result.localMerged.fecha_entrega).toBe('2026-09-25');
            expect(result.localMerged.fecha_minima_requerida).toBe('2026-09-25');
            expect(result.serverPayload.fecha_entrega).toBe('2026-09-25');
            expect(result.serverPayload['EXTRA_Fecha mínima requerida por comercial/cliente']).toBe('2026-09-25');
        });

        it('propaga fecha_minima_requerida hacia fecha_entrega si solo viene fecha_minima_requerida', () => {
            const result = mapPedidoServerPayload({
                uuid_generado: 'ped-2',
                fecha_minima_requerida: '2026-10-15'
            });

            expect(result.localMerged.fecha_entrega).toBe('2026-10-15');
            expect(result.localMerged.fecha_minima_requerida).toBe('2026-10-15');
            expect(result.serverPayload.fecha_entrega).toBe('2026-10-15');
            expect(result.serverPayload['EXTRA_Fecha mínima requerida por comercial/cliente']).toBe('2026-10-15');
        });

        it('preserva las columnas nativas booleanas cierre_facturacion y es_muestra en serverPayload', () => {
            const result = mapPedidoServerPayload({
                uuid_generado: 'ped-3',
                cierre_facturacion: true,
                es_muestra: true
            });

            // Conserva columnas nativas booleanas en Postgres
            expect(result.serverPayload.cierre_facturacion).toBe(true);
            expect(result.serverPayload.es_muestra).toBe(true);

            // Mapea también a columnas SAP EXTRA_
            expect(result.serverPayload['EXTRA_Cierre Facturación']).toBe(true);
            expect(result.serverPayload['EXTRA_¿Es una muestra?']).toBe(true);
        });

        it('preserva campos logísticos y de contacto en serverPayload', () => {
            const result = mapPedidoServerPayload({
                uuid_generado: 'ped-4',
                email_contacto: 'cliente@ejemplo.com',
                tiene_escaleras: true,
                planos_hidromasaje: 'Piso 3, lado derecho',
                tipo_pod: 'POD Total'
            });

            expect(result.serverPayload.email_contacto).toBe('cliente@ejemplo.com');
            expect(result.serverPayload.tiene_escaleras).toBe(true);
            expect(result.serverPayload.planos_hidromasaje).toBe('Piso 3, lado derecho');
            expect(result.serverPayload.tipo_pod).toBe('POD Total');
        });
    });

    describe('Contrato en lib/sync.ts para pull de CRM_Pedidos', () => {
        it('mapea fecha_entrega y fecha_minima_requerida con fallback mutuo en sync.ts', () => {
            const syncSource = readFileSync(path.join(root, 'lib', 'sync.ts'), 'utf8');
            const pullStart = syncSource.indexOf('// Pull Pedidos (CRM_Pedidos)');
            const pullEnd = syncSource.indexOf('// Pull Pedido Items (CRM_PedidoItems)', pullStart);
            const pedidosBlock = syncSource.slice(pullStart, pullEnd);

            expect(pedidosBlock).toMatch(/fecha_entrega:\s*p\['fecha_entrega'\]\s*\|\|\s*p\['EXTRA_Fecha mínima requerida por comercial\/cliente'\]/);
            expect(pedidosBlock).toMatch(/fecha_minima_requerida:\s*p\['EXTRA_Fecha mínima requerida por comercial\/cliente'\]\s*\|\|\s*p\['fecha_entrega'\]/);
        });
    });
});
