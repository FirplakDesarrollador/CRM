import React from 'react';

export type EntityType = 'oportunidad' | 'cuenta' | 'contacto' | 'actividad' | 'cotizacion';

export interface EntityUrlOptions {
    opportunityId?: string;
    [key: string]: string | undefined;
}

/**
 * Retorna la URL canónica para acceder a una entidad específica en el CRM.
 */
export function getEntityUrl(entityType: EntityType, id: string, options?: EntityUrlOptions): string {
    const { opportunityId, ...extraParams } = options || {};

    let path = '';
    const query = new URLSearchParams();

    switch (entityType) {
        case 'oportunidad':
            path = `/oportunidades/${id}`;
            break;
        case 'cuenta':
            path = '/cuentas';
            query.set('id', id);
            break;
        case 'contacto':
            path = '/contactos';
            query.set('id', id);
            break;
        case 'actividad':
            path = '/actividades';
            query.set('id', id);
            break;
        case 'cotizacion':
            if (opportunityId) {
                path = `/oportunidades/${opportunityId}/cotizaciones/${id}`;
            } else {
                path = `/oportunidades?quoteId=${id}`;
            }
            break;
    }

    if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
                query.set(k, v);
            }
        });
    }

    const queryString = query.toString();
    return queryString ? `${path}${path.includes('?') ? '&' : '?'}${queryString}` : path;
}

/**
 * Manejador estándar de clics para elementos interactivos que son enlaces (`<a>`).
 * Si el usuario realiza un clic izquierdo normal (sin teclas modificadoras como Ctrl/Cmd/Shift),
 * ejecuta `onNormalClick` y previene la navegación estándar para mantener el estado/modal de la SPA.
 * Si el usuario presiona Ctrl, Cmd, Shift, Alt o clic central (rueda del mouse),
 * NO previene el evento, permitiendo que el navegador abra el enlace en una pestaña nueva o ventana.
 */
export function handleEntityLinkClick(
    e: React.MouseEvent | MouseEvent,
    url: string,
    onNormalClick?: () => void
): void {
    // Si fue clic central (rueda del ratón, button === 1) o clic secundario (clic derecho, button === 2), permitir comportamiento nativo
    if (e.button === 1 || e.button === 2) {
        return;
    }

    // Si el usuario mantiene presionado Ctrl, Meta (Cmd en Mac), Shift o Alt, permitir que el navegador abra en nueva pestaña/ventana
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
        return;
    }

    // Clic normal izquierdo: prevenir navegación estándar y ejecutar handler local
    if (onNormalClick) {
        e.preventDefault();
        onNormalClick();
    }
}
