import { describe, expect, it } from 'vitest';
import { AuditLogEntry } from '@/lib/hooks/useEntityAuditHistory';

describe('Audit History Formatting and Filtering', () => {
    const mockEntries: AuditLogEntry[] = [
        {
            id: 'audit-1',
            entity_type: 'OPORTUNIDAD',
            entity_id: 'opp-100',
            field_name: 'fase_id',
            field_label: 'Fase',
            old_value: 'Prospección',
            new_value: 'Cotización',
            changed_by: 'user-1',
            changed_by_name: 'Juan Diego Flórez',
            changed_at: '2026-10-23T10:00:00Z'
        },
        {
            id: 'audit-2',
            entity_type: 'OPORTUNIDAD',
            entity_id: 'opp-100',
            field_name: 'amount',
            field_label: 'Valor',
            old_value: '5000000',
            new_value: '7500000',
            changed_by: 'user-2',
            changed_by_name: 'Stiven Valencia',
            changed_at: '2026-10-23T11:30:00Z'
        },
        {
            id: 'audit-3',
            entity_type: 'CUENTA',
            entity_id: 'acc-200',
            field_name: 'telefono',
            field_label: 'Teléfono',
            old_value: null,
            new_value: '3007367088',
            changed_by: 'user-1',
            changed_by_name: 'Juan Diego Flórez',
            changed_at: '2026-10-23T12:00:00Z'
        }
    ];

    it('filtra correctamente por campo específico', () => {
        const filtered = mockEntries.filter(e => (e.field_label || e.field_name) === 'Fase');
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('audit-1');
        expect(filtered[0].old_value).toBe('Prospección');
        expect(filtered[0].new_value).toBe('Cotización');
    });

    it('busca texto coincidente en usuario, valores o etiquetas', () => {
        const searchUser = 'Stiven';
        const resultUser = mockEntries.filter(e => 
            (e.changed_by_name || '').toLowerCase().includes(searchUser.toLowerCase())
        );
        expect(resultUser).toHaveLength(1);
        expect(resultUser[0].field_label).toBe('Valor');

        const searchVal = '3007367088';
        const resultVal = mockEntries.filter(e => 
            (e.new_value || '').toLowerCase().includes(searchVal.toLowerCase())
        );
        expect(resultVal).toHaveLength(1);
        expect(resultVal[0].entity_type).toBe('CUENTA');
    });

    it('maneja valores nulos en old_value y new_value sin lanzar excepciones', () => {
        const nullEntry = mockEntries.find(e => e.old_value === null);
        expect(nullEntry).toBeDefined();
        const displayOldValue = nullEntry?.old_value ?? '(Vacío)';
        expect(displayOldValue).toBe('(Vacío)');
    });
});
