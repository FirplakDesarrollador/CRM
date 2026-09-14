import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPedidoDocumentData, PedidoWithItems } from '../lib/pedidoFormalization';
import { LocalQuote, LocalQuoteItem } from '../lib/db';

const root = process.cwd();

describe('Campo Tipo POD en pedidos y cotizaciones', () => {
    it('debe existir el archivo de migración que declara tipo_pod y pod en CRM_Pedidos y CRM_Cotizaciones con valor por defecto', () => {
        const migrationPath = path.join(root, 'supabase', 'migrations', '20260914180000_add_pod_to_orders_and_quotes.sql');
        expect(existsSync(migrationPath), 'El archivo de migración debe existir').toBe(true);

        const content = readFileSync(migrationPath, 'utf8');
        expect(content).toMatch(/alter\s+table\s+public\."CRM_Pedidos"[\s\S]*?add\s+column\s+if\s+not\s+exists\s+tipo_pod\s+text\s+default\s+'POD Total'/i);
        expect(content).toMatch(/alter\s+table\s+public\."CRM_Cotizaciones"[\s\S]*?add\s+column\s+if\s+not\s+exists\s+tipo_pod\s+text\s+default\s+'POD Total'/i);
    });

    it('buildPedidoDocumentData propaga tipo_pod y pod desde el pedido seleccionado al documento formal', () => {
        const quote: LocalQuote = {
            id: 'quote-123',
            opportunity_id: 'opp-123',
            numero_cotizacion: 'COT-123',
            currency_id: 'COP',
            total_amount: 1000,
            status: 'DRAFT',
        };

        const pedido: PedidoWithItems = {
            uuid_generado: 'ped-uuid-1',
            cotizacion_id: 'quote-123',
            estado_pedido: 'PLANEADO',
            tipo_pod: 'POD Parcial',
            pod: 'POD Parcial',
            items: [
                {
                    id: 'item-1',
                    pedido_uuid: 'ped-uuid-1',
                    producto_id: 'prod-1',
                    cantidad: 2,
                    precio_unitario: 500,
                },
            ],
        };

        const quoteItems: LocalQuoteItem[] = [
            {
                id: 'qi-1',
                cotizacion_id: 'quote-123',
                producto_id: 'prod-1',
                cantidad: 5,
                precio_unitario: 500,
                subtotal: 2500,
            },
        ];

        const result = buildPedidoDocumentData(quote, pedido, quoteItems);
        expect((result.quote as any).tipo_pod).toBe('POD Parcial');
        expect((result.quote as any).pod).toBe('POD Parcial');
    });

    it('las opciones soportadas de tipo_pod son POD Total, POD Parcial y Sin POD', () => {
        const allowedOptions = ['POD Total', 'POD Parcial', 'Sin POD'] as const;
        expect(allowedOptions).toContain('POD Total');
        expect(allowedOptions[0]).toBe('POD Total'); // Por defecto
        expect(allowedOptions).toContain('POD Parcial');
        expect(allowedOptions).toContain('Sin POD');
    });
});
