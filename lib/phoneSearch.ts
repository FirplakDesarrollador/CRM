import type { SupabaseClient } from '@supabase/supabase-js';
import { digitsOnly, isPhoneLikeQuery, getPhoneIlikePatterns } from '@/lib/utils';

/**
 * Búsqueda por número de celular en Cuentas, Contactos, Oportunidades y Actividades.
 *
 * Se compara solo el número tal como lo escribe el usuario (únicamente se ignoran espacios,
 * guiones, puntos y paréntesis). No se agrega, quita ni compara indicativo de país.
 */

/** Máximo de contactos/cuentas que se traen al buscar un celular (evita URLs gigantes en PostgREST). */
const MAX_PHONE_MATCHES = 200;

/** Devuelve los dígitos del término si la búsqueda completa es un celular; si no, null. */
export function getCellphoneSearchDigits(searchTerm: string | null | undefined): string | null {
    if (!searchTerm || !isPhoneLikeQuery(searchTerm)) return null;
    const digits = digitsOnly(searchTerm);
    return digits || null;
}

/** ¿El teléfono guardado contiene el número buscado? (solo dígitos, sin indicativo). */
export function phoneMatchesDigits(storedPhone: string | null | undefined, digits: string | null | undefined): boolean {
    if (!digits || !storedPhone) return false;
    return digitsOnly(storedPhone).includes(digits);
}

export type PhoneSearchMatches = {
    /** Contactos cuyo teléfono coincide. */
    contactIds: Set<string>;
    /** Cuentas cuyo teléfono propio coincide o que tienen un contacto que coincide. */
    accountIds: Set<string>;
};

/** Filtro PostgREST `or` sobre la columna telefono para el número buscado. */
export function getTelefonoOrFilter(digits: string): string {
    return getPhoneIlikePatterns(digits).map(pattern => `telefono.ilike.${pattern}`).join(',');
}

/**
 * Busca en Supabase (con la sesión del usuario, así que respeta RLS) los contactos y cuentas
 * cuyo teléfono coincide con el número buscado.
 */
export async function findPhoneMatchesServer(client: SupabaseClient, digits: string): Promise<PhoneSearchMatches> {
    const contactIds = new Set<string>();
    const accountIds = new Set<string>();
    const phoneOr = getTelefonoOrFilter(digits);
    if (!phoneOr) return { contactIds, accountIds };

    const [accRes, contactRes] = await Promise.all([
        client.from('CRM_Cuentas').select('id').eq('is_deleted', false).or(phoneOr).limit(MAX_PHONE_MATCHES),
        client.from('CRM_Contactos').select('id, account_id').eq('is_deleted', false).or(phoneOr).limit(MAX_PHONE_MATCHES)
    ]);

    ((accRes?.data || []) as Array<{ id: string }>).forEach(a => a.id && accountIds.add(a.id));
    ((contactRes?.data || []) as Array<{ id: string; account_id: string | null }>).forEach(c => {
        if (c.id) contactIds.add(c.id);
        if (c.account_id) accountIds.add(c.account_id);
    });
    return { contactIds, accountIds };
}

/** Igual que findPhoneMatchesServer pero sobre la copia local (Dexie). */
export function findPhoneMatchesLocal(
    contacts: Array<{ id: string; account_id?: string | null; telefono?: string | null; is_deleted?: boolean | null }>,
    accounts: Array<{ id: string; telefono?: string | null; is_deleted?: boolean | null }>,
    digits: string
): PhoneSearchMatches {
    const contactIds = new Set<string>();
    const accountIds = new Set<string>();
    for (const a of accounts) {
        if (a.is_deleted) continue;
        if (phoneMatchesDigits(a.telefono, digits)) accountIds.add(a.id);
    }
    for (const c of contacts) {
        if (c.is_deleted) continue;
        if (phoneMatchesDigits(c.telefono, digits)) {
            contactIds.add(c.id);
            if (c.account_id) accountIds.add(c.account_id);
        }
    }
    return { contactIds, accountIds };
}

/** ¿La oportunidad está ligada al celular buscado (por su cuenta o por alguno de sus contactos)? */
export function opportunityMatchesPhone(
    opp: { account_id?: string | null; contactos_ids?: string[] | null },
    matches: PhoneSearchMatches | null
): boolean {
    if (!matches) return false;
    if (opp.account_id && matches.accountIds.has(opp.account_id)) return true;
    return Array.isArray(opp.contactos_ids) && opp.contactos_ids.some(id => matches.contactIds.has(id));
}
