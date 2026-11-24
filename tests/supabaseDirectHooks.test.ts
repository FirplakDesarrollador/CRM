import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    conflictColumnForTable,
    sanitizeTablePayload,
    TABLE_COLUMNS,
} from '../lib/supabaseDirect';

describe('Fase 1: Escritura y lectura directa a Supabase en hooks principales', () => {
    it('excluye columnas generadas o solo-UI al sanitizar payloads para Supabase', () => {
        const quoteItemPayload = sanitizeTablePayload('CRM_CotizacionItems', {
            id: 'item-1',
            cotizacion_id: 'quote-1',
            producto_id: 'prod-1',
            cantidad: 2,
            precio_unitario: 100000,
            final_unit_price: 90000,
            subtotal: 180000, // GENERATED ALWAYS in Postgres — must be stripped
            extra_ui_flag: true,
        });
        expect(quoteItemPayload).toHaveProperty('id', 'item-1');
        expect(quoteItemPayload).toHaveProperty('final_unit_price', 90000);
        expect(quoteItemPayload).not.toHaveProperty('subtotal');
        expect(quoteItemPayload).not.toHaveProperty('extra_ui_flag');

        const quotePayload = sanitizeTablePayload('CRM_Cotizaciones', {
            id: 'quote-1',
            opportunity_id: 'opp-1',
            numero_cotizacion: 'COT-123456',
            status: 'WINNER',
            is_winner: true, // UI-only alias — not a column in CRM_Cotizaciones
            fecha_entrega: '', // Empty date string must become null
        });
        expect(quotePayload).toHaveProperty('status', 'WINNER');
        expect(quotePayload).not.toHaveProperty('is_winner');
        expect(quotePayload.fecha_entrega).toBeNull();

        const accountPayload = sanitizeTablePayload('CRM_Cuentas', {
            id: 'acc-1',
            nombre: 'Constructora Firplak',
            canal_id: 'OBRAS_NAC',
            is_child: false, // UI-only field
        });
        expect(accountPayload).toHaveProperty('nombre', 'Constructora Firplak');
        expect(accountPayload).not.toHaveProperty('is_child');

        const pedidoPayload = sanitizeTablePayload('CRM_Pedidos', {
            id: 999, // Serial/identity PK in Postgres; conflict key is uuid_generado
            uuid_generado: 'ped-uuid-1',
            cotizacion_id: 'quote-1',
            estado_pedido: 'PLANEADO',
            fecha_entrega: '',
        });
        expect(pedidoPayload).toHaveProperty('uuid_generado', 'ped-uuid-1');
        expect(pedidoPayload).not.toHaveProperty('id');
        expect(pedidoPayload.fecha_entrega).toBeNull();
    });

    it('usa uuid_generado como clave de conflicto para CRM_Pedidos e id para las demás tablas', () => {
        expect(conflictColumnForTable('CRM_Pedidos')).toBe('uuid_generado');
        expect(conflictColumnForTable('CRM_Actividades')).toBe('id');
        expect(conflictColumnForTable('CRM_Cotizaciones')).toBe('id');
        expect(conflictColumnForTable('CRM_CotizacionItems')).toBe('id');
        expect(conflictColumnForTable('CRM_Oportunidades')).toBe('id');
        expect(conflictColumnForTable('CRM_Contactos')).toBe('id');
        expect(conflictColumnForTable('CRM_Cuentas')).toBe('id');
    });

    it('declara las columnas clave de cada tabla maestra de Supabase', () => {
        expect(TABLE_COLUMNS.CRM_Actividades.has('user_id')).toBe(true);
        expect(TABLE_COLUMNS.CRM_Actividades.has('prioridad')).toBe(true);
        expect(TABLE_COLUMNS.CRM_Cotizaciones.has('total_amount')).toBe(true);
        expect(TABLE_COLUMNS.CRM_CotizacionItems.has('subtotal')).toBe(false);
        expect(TABLE_COLUMNS.CRM_Oportunidades.has('setter')).toBe(true);
        expect(TABLE_COLUMNS.CRM_Contactos.has('es_principal')).toBe(true);
        expect(TABLE_COLUMNS.CRM_Cuentas.has('nit_base')).toBe(true);
        expect(TABLE_COLUMNS.CRM_Pedidos.has('uuid_generado')).toBe(true);
        expect(TABLE_COLUMNS.CRM_PedidoItems.has('pedido_uuid')).toBe(true);
    });

    it('los hooks principales de Fase 1 usan supabaseDirect en lugar de depender de syncEngine.commitLocalChanges', () => {
        const root = process.cwd();
        const hookFiles = [
            'lib/hooks/useActivities.ts',
            'lib/hooks/useOpportunities.ts',
            'lib/hooks/useContacts.ts',
            'lib/hooks/usePedidos.ts',
            'lib/hooks/useAccounts.ts',
        ];

        for (const relPath of hookFiles) {
            const source = readFileSync(path.join(root, relPath), 'utf8');
            expect(source, `${relPath} debe importar supabaseDirect`).toContain('supabaseDirect');
            expect(source, `${relPath} no debe usar syncEngine.commitLocalChanges`).not.toContain('syncEngine.commitLocalChanges');
        }
    });

    it('Fase 2: formularios, comboboxes, pestañas y AppLayout operan directo con Supabase sin depender de syncEngine', () => {
        const root = process.cwd();
        const phase2Files = [
            'components/layout/AppLayout.tsx',
            'components/activities/CreateActivityModal.tsx',
            'components/oportunidades/CollaboratorsTab.tsx',
            'components/quotes/PedidosEditor.tsx',
            'components/opportunities/OpportunityCombobox.tsx',
            'components/accounts/AccountCombobox.tsx',
            'components/dashboard/SalesFunnelTile.tsx',
            'app/actividades/page.tsx',
            'app/oportunidades/[id]/page.tsx',
            'lib/hooks/useCommissionDashboard.ts',
            'lib/hooks/useCommissionLedger.ts',
            'lib/hooks/useAccountsServer.ts',
            'lib/hooks/useActivitiesServer.ts',
        ];

        for (const relPath of phase2Files) {
            const source = readFileSync(path.join(root, relPath), 'utf8');
            expect(source, `${relPath} no debe importar ni invocar syncEngine`).not.toContain('syncEngine');
        }

        const comboboxSource = readFileSync(path.join(root, 'components/opportunities/OpportunityCombobox.tsx'), 'utf8');
        expect(comboboxSource).not.toContain('@/lib/db');
    });

    it('Fase 3: páginas de detalle (Oportunidad, Cotización, Pedidos) y Sucursales cargan directo desde Supabase', () => {
        const root = process.cwd();
        const oppDetail = readFileSync(path.join(root, 'app/oportunidades/[id]/page.tsx'), 'utf8');
        const quoteDetail = readFileSync(path.join(root, 'app/oportunidades/[id]/cotizaciones/[quoteId]/page.tsx'), 'utf8');
        const pedidosPage = readFileSync(path.join(root, 'app/pedidos/page.tsx'), 'utf8');
        const branchesTab = readFileSync(path.join(root, 'components/cuentas/AccountBranchesTab.tsx'), 'utf8');

        expect(oppDetail).toContain('hydrateOpportunityDetailFromSupabase');
        expect(quoteDetail).toContain('hydrateQuoteDetailFromSupabase');
        expect(pedidosPage).toContain('hydratePedidosModuleFromSupabase');
        expect(branchesTab).not.toContain('dexie-react-hooks');
        expect(branchesTab).not.toContain('@/lib/db');
        expect(branchesTab).toContain('CRM_Cuentas');
    });

    it('Fase 4: modales, formularios de contacto/usuario, indicadores y notificaciones operan directo contra Supabase sin Dexie', () => {
        const root = process.cwd();
        const phase4Files = [
            'components/oportunidades/LossReasonModal.tsx',
            'components/contactos/ContactForm.tsx',
            'components/contactos/CreateContactWizard.tsx',
            'components/usuarios/UserForm.tsx',
            'lib/hooks/useIndicadoresLookups.ts',
            'components/indicadores/VentasGanadasTile.tsx',
            'lib/hooks/useNotifications.ts',
        ];

        for (const relPath of phase4Files) {
            const source = readFileSync(path.join(root, relPath), 'utf8');
            expect(source, `${relPath} no debe importar dexie-react-hooks`).not.toContain('dexie-react-hooks');
            expect(source, `${relPath} no debe usar db. de Dexie`).not.toMatch(/\bdb\./);
        }
    });

    it('los catálogos de actividad consultan CRM_Activity_Clasificacion y CRM_Activity_Subclasificacion', () => {
        const root = process.cwd();
        const direct = readFileSync(path.join(root, 'lib/supabaseDirect.ts'), 'utf8');
        const indicadores = readFileSync(path.join(root, 'lib/hooks/useIndicadoresLookups.ts'), 'utf8');

        expect(direct).toContain("from('CRM_Activity_Clasificacion')");
        expect(direct).toContain("from('CRM_Activity_Subclasificacion')");
        expect(direct).not.toContain('CRM_ClasificacionesActividad');
        expect(direct).not.toContain('CRM_SubclasificacionesActividad');

        expect(indicadores).toContain('from("CRM_Activity_Clasificacion")');
        expect(indicadores).not.toContain('CRM_ClasificacionesActividad');
        expect(indicadores).not.toContain('CRM_SubclasificacionesActividad');
    });
});
