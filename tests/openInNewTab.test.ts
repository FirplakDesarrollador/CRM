import { describe, it, expect, vi } from 'vitest';
import { getEntityUrl, handleEntityLinkClick } from '../lib/utils/navigation';

describe('Navigation & Open in New Tab Helpers', () => {
    describe('getEntityUrl', () => {
        it('debe generar la URL canónica correcta para cada tipo de entidad', () => {
            expect(getEntityUrl('oportunidad', 'opp-123')).toBe('/oportunidades/opp-123');
            expect(getEntityUrl('cuenta', 'acc-456')).toBe('/cuentas?id=acc-456');
            expect(getEntityUrl('contacto', 'con-789')).toBe('/contactos?id=con-789');
            expect(getEntityUrl('actividad', 'act-101')).toBe('/actividades?id=act-101');
            expect(getEntityUrl('cotizacion', 'q-202', { opportunityId: 'opp-123' })).toBe('/oportunidades/opp-123/cotizaciones/q-202');
        });

        it('debe preservar parámetros adicionales cuando se especifiquen', () => {
            expect(getEntityUrl('cuenta', 'acc-456', { view: 'details' })).toBe('/cuentas?id=acc-456&view=details');
        });
    });

    describe('handleEntityLinkClick', () => {
        it('debe ejecutar la acción normal cuando es un clic primario (izquierdo) sin teclas modificadoras', () => {
            const onNormalClick = vi.fn();
            const preventDefault = vi.fn();
            const mockEvent = {
                button: 0,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false,
                altKey: false,
                preventDefault,
            } as unknown as React.MouseEvent;

            handleEntityLinkClick(mockEvent, '/cuentas?id=123', onNormalClick);

            expect(preventDefault).toHaveBeenCalled();
            expect(onNormalClick).toHaveBeenCalled();
        });

        it('no debe prevenir la acción por defecto si se presiona Ctrl o Meta para permitir abrir en nueva pestaña', () => {
            const onNormalClick = vi.fn();
            const preventDefault = vi.fn();
            const mockEventCtrl = {
                button: 0,
                ctrlKey: true,
                metaKey: false,
                shiftKey: false,
                altKey: false,
                preventDefault,
            } as unknown as React.MouseEvent;

            handleEntityLinkClick(mockEventCtrl, '/cuentas?id=123', onNormalClick);

            expect(preventDefault).not.toHaveBeenCalled();
            expect(onNormalClick).not.toHaveBeenCalled();

            const mockEventMeta = {
                button: 0,
                ctrlKey: false,
                metaKey: true,
                shiftKey: false,
                altKey: false,
                preventDefault,
            } as unknown as React.MouseEvent;

            handleEntityLinkClick(mockEventMeta, '/cuentas?id=123', onNormalClick);

            expect(preventDefault).not.toHaveBeenCalled();
            expect(onNormalClick).not.toHaveBeenCalled();
        });

        it('no debe prevenir la acción por defecto en clic central (rueda del ratón, button = 1)', () => {
            const onNormalClick = vi.fn();
            const preventDefault = vi.fn();
            const mockEventMiddle = {
                button: 1,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false,
                altKey: false,
                preventDefault,
            } as unknown as React.MouseEvent;

            handleEntityLinkClick(mockEventMiddle, '/cuentas?id=123', onNormalClick);

            expect(preventDefault).not.toHaveBeenCalled();
            expect(onNormalClick).not.toHaveBeenCalled();
        });
    });
});
