import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const syncSource = readFileSync(path.join(root, 'lib', 'sync.ts'), 'utf8');
const migrationSource = readFileSync(
    path.join(root, 'supabase', 'migrations', '20260904193842_persist_crm_editable_fields.sql'),
    'utf8'
);

function pullBlock(startMarker: string, endMarker: string) {
    const start = syncSource.indexOf(startMarker);
    const end = syncSource.indexOf(endMarker, start + startMarker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return syncSource.slice(start, end);
}

function migrationBlock(table: string) {
    const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = migrationSource.match(
        new RegExp(`alter\\s+table\\s+public\\."${escapedTable}"([\\s\\S]*?);`, 'i')
    );
    expect(match, `No se encontró ALTER TABLE para ${table}`).not.toBeNull();
    return match?.[1] ?? '';
}

function expectColumns(block: string, columns: string[]) {
    for (const column of columns) {
        expect(block, `Falta la columna ${column}`).toMatch(
            new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${column}\\b`, 'i')
        );
    }
}

describe('contratos de persistencia de campos editables', () => {
    it('conserva origen_cuenta y comentarios al reconstruir los espejos locales', () => {
        const accountsPull = pullBlock('// Pull Accounts (CRM_Cuentas)', '// CLEANUP: Remove locally-cached accounts');
        const contactsPull = pullBlock('// Pull Contacts (CRM_Contactos)', '// Pull Opportunity Collaborators');

        expect(accountsPull).toMatch(/origen_cuenta:\s*a\.origen_cuenta/);
        expect(contactsPull).toMatch(/comentarios:\s*c\.comentarios/);
    });

    it('conserva el registro remoto completo al descargar cotizaciones', () => {
        const quotesPull = pullBlock('// Pull Quotes (CRM_Cotizaciones)', '// Pull Quote Items (CRM_CotizacionItems)');

        expect(quotesPull).toMatch(/quotesToPut\.push\(\{\s*\.\.\.q\s*\}\)/s);
    });

    it('declara en PostgreSQL todos los campos editables que el cliente sincroniza', () => {
        expectColumns(migrationBlock('CRM_Contactos'), ['comentarios']);
        expectColumns(migrationBlock('CRM_Cotizaciones'), [
            'comentarios',
            'cliente_final',
            'email_contacto',
            'contacto_ventas',
            'contacto_logistico',
            'contacto_tesoreria',
            'dir_envio_factura_tipo',
            'servicio_subida_hidromasaje',
            'piso_entrega',
            'tiene_escaleras',
            'planos_hidromasaje',
            'fecha_entrega',
            'nit_cliente_final',
            'entrega_en_obra',
            'bodega_externa',
            'bodega_firplak'
        ]);
        expectColumns(migrationBlock('CRM_Pedidos'), [
            'email_contacto',
            'tiene_escaleras',
            'planos_hidromasaje',
            'fecha_entrega'
        ]);
    });
});
