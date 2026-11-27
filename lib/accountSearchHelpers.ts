import { accentInsensitiveCondition, getPhoneIlikePatterns } from '@/lib/utils';

/**
 * Limpia caracteres que rompen la sintaxis de filtros `.or(...)` en PostgREST.
 */
export function sanitizePostgrestToken(token: string | null | undefined): string {
    if (!token) return '';
    return String(token)
        .replace(/[,()"%*]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Construye la cláusula `.or(...)` en Supabase para un token de búsqueda de cuentas,
 * preservando búsqueda insensible a tildes en `nombre` y `ciudad`, coincidencias en
 * `nit_base`, `nit`, `telefono`, `email` y cuentas enlazadas por celular de contacto.
 */
export function buildAccountTokenOrFilter(
    token: string,
    phoneAccountIds: string[] = []
): string {
    const clean = sanitizePostgrestToken(token);
    const orParts: string[] = [];

    if (clean) {
        orParts.push(accentInsensitiveCondition('nombre', clean));
        orParts.push(`nit_base.ilike.%${clean}%`);
        orParts.push(`nit.ilike.%${clean}%`);
        orParts.push(`telefono.ilike.%${clean}%`);
        orParts.push(accentInsensitiveCondition('ciudad', clean));
        orParts.push(`email.ilike.%${clean}%`);

        for (const pattern of getPhoneIlikePatterns(clean)) {
            const safePattern = pattern.replace(/[,()"]/g, '');
            if (safePattern) {
                orParts.push(`telefono.ilike.${safePattern}`);
            }
        }
    }

    if (phoneAccountIds.length > 0) {
        const cappedIds = phoneAccountIds.slice(0, 100);
        orParts.push(`id.in.(${cappedIds.join(',')})`);
    }

    return orParts.join(',');
}

export interface ResolveAccountLabelInput {
    value?: string | null;
    accounts: Array<{ id: string; nombre: string }>;
    resolvedName?: string | null;
    initialLabel?: string | null;
    isResolving?: boolean;
}

/**
 * Resuelve la etiqueta visible del botón del combobox de cuentas evitando quedar
 * indefinidamente en "Cargando..." cuando la resolución finaliza sin resultados.
 */
export function resolveAccountComboboxLabel({
    value,
    accounts,
    resolvedName,
    initialLabel,
    isResolving = false,
}: ResolveAccountLabelInput): string {
    const currentId = String(value || '').trim();
    if (!currentId || currentId === 'undefined' || currentId === 'null') {
        return 'Seleccione una cuenta...';
    }

    const found = accounts.find((a) => String(a.id) === currentId);
    if (found?.nombre) return found.nombre;
    if (resolvedName && resolvedName.trim()) return resolvedName;
    if (initialLabel && initialLabel.trim()) return initialLabel;
    return isResolving ? 'Cargando...' : 'Cuenta seleccionada';
}
