/**
 * Nivel de cliente almacenado en CRM_Cuentas.nivel_premium.
 * Mismos valores que el formulario de cuentas (Premium / Destacado / Activo)
 * y el mismo fallback "Regular" de las tarjetas del listado.
 * No se calcula por compras: es el campo que ya guarda y muestra Cuentas.
 */
export interface AccountNivelBadgeModel {
    label: string;
    className: string;
    title: string;
}

const KNOWN_NIVEL: Record<string, { label: string; className: string }> = {
    PREMIUM: {
        label: 'Premium',
        className: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    DESTACADO: {
        label: 'Destacado',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    ACTIVO: {
        label: 'Activo',
        className: 'bg-orange-50 text-orange-700 border-orange-200',
    },
};

const REGULAR_BADGE: AccountNivelBadgeModel = {
    label: 'Regular',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    title: 'Nivel de cliente: Regular',
};

export function resolveAccountNivelBadge(nivel: string | null | undefined): AccountNivelBadgeModel {
    const trimmed = typeof nivel === 'string' ? nivel.trim() : '';
    if (!trimmed) return REGULAR_BADGE;

    const known = KNOWN_NIVEL[trimmed.toUpperCase()];
    if (known) {
        return {
            label: known.label,
            className: known.className,
            title: `Nivel de cliente: ${known.label}`,
        };
    }

    return {
        label: trimmed,
        className: REGULAR_BADGE.className,
        title: `Nivel de cliente: ${trimmed}`,
    };
}
