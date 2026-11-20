import type { SupabaseClient } from '@supabase/supabase-js';
import {
    LEAD_MIN_AMOUNT_CONFIG_KEY,
    parseLeadMinimumAmountConfig,
    type LeadMinimumAmountConfig,
} from '../supabase/functions/wordpress-lead-intake/leadMinimumAmount';

export {
    LEAD_MIN_AMOUNT_CONFIG_KEY,
    normalizeLeadCategory,
    parseLeadMinimumAmountConfig,
    resolveLeadMinimumAmount,
    shouldApplyLeadMinimum,
    splitLeadCategories,
} from '../supabase/functions/wordpress-lead-intake/leadMinimumAmount';
export type { LeadMinimumAmountConfig, LeadMinimumMode } from '../supabase/functions/wordpress-lead-intake/leadMinimumAmount';

/**
 * Lee la tabla de montos mínimos por categoría desde CRM_Configuracion.
 * Si no existe la clave, no hay red o falla la consulta, devuelve null y la
 * oportunidad se crea como siempre (sin monto mínimo).
 */
export async function fetchLeadMinimumAmountConfig(
    client: Pick<SupabaseClient, 'from'>
): Promise<LeadMinimumAmountConfig | null> {
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
        const { data, error } = await client
            .from('CRM_Configuracion')
            .select('value')
            .eq('key', LEAD_MIN_AMOUNT_CONFIG_KEY)
            .maybeSingle();
        if (error || !data) return null;
        const config = parseLeadMinimumAmountConfig((data as { value?: unknown }).value);
        return config.amounts.size > 0 ? config : null;
    } catch {
        return null;
    }
}
