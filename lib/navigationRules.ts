// Definición de ítems de navegación del sistema y sus restricciones
export interface NavItemConfig {
    label: string;
    href: string;
    requiredRole?: 'ADMIN' | 'COORDINADOR';
}

export const SYSTEM_NAV_ITEMS: NavItemConfig[] = [
    { label: "Inicio", href: "/" },
    { label: "Oportunidades", href: "/oportunidades" },
    { label: "Cuentas", href: "/cuentas" },
    { label: "Contactos", href: "/contactos" },
    { label: "Actividades", href: "/actividades" },
    { label: "Pedidos", href: "/pedidos" },
    { label: "Comisiones", href: "/comisiones" },
    { label: "Indicadores", href: "/indicadores" },
    { label: "Tiendas-Ferias", href: "/tiendas" },
    { label: "Catálogo", href: "/catalogo" },
    { label: "Inventarios", href: "/inventarios", requiredRole: 'ADMIN' },
    { label: "Informes", href: "/informes", requiredRole: 'ADMIN' },
    { label: "Usuarios", href: "/usuarios", requiredRole: 'ADMIN' },
    { label: "Configuración", href: "/configuracion" },
];

/**
 * Filtra los ítems de navegación visibles según el rol del usuario autenticado.
 */
export function getVisibleNavItems(items: NavItemConfig[], role: string | null | undefined): NavItemConfig[] {
    return items.filter(item => {
        if (!item.requiredRole) return true;
        if (item.requiredRole === 'ADMIN') return role === 'ADMIN';
        if (item.requiredRole === 'COORDINADOR') return role === 'ADMIN' || role === 'COORDINADOR';
        return false;
    });
}

/**
 * Sanitiza los parámetros de URL para persistir únicamente los filtros de lista en sessionStorage,
 * garantizando que ningún identificador de entidad ('id') sea retenido.
 */
export function sanitizeStateForSessionStorage(queryStringOrParams: string | URLSearchParams): string {
    const params = typeof queryStringOrParams === 'string'
        ? new URLSearchParams(queryStringOrParams.startsWith('?') ? queryStringOrParams.slice(1) : queryStringOrParams)
        : new URLSearchParams(queryStringOrParams.toString());

    params.delete('id');
    return params.toString();
}

/**
 * Determina el estado de edición según los parámetros de búsqueda de la URL.
 */
export function resolveEditingEntityId(searchParamsString: string): string | null {
    const params = new URLSearchParams(searchParamsString.startsWith('?') ? searchParamsString.slice(1) : searchParamsString);
    return params.get('id');
}
