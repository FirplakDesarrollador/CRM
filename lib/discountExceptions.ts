/**
 * Excepciones de descuento por línea de cotización (canal constructor / Obras Nacional).
 *
 * Regla general (sin cambios): el descuento de cada línea no puede superar el máximo
 * que devuelve `get_recommended_pricing` para el canal y la cantidad.
 *
 * Excepción: solo en los canales listados aquí, un ADMIN o COORDINADOR puede autorizar
 * un descuento mayor dejando un motivo, que queda registrado en los comentarios de la
 * cotización (auditoría). Un asesor (VENDEDOR) sigue limitado al máximo, pero puede
 * dejar registrada una solicitud de excepción para que la autoricen.
 * Los demás canales siguen exactamente igual que antes.
 */
export const CANALES_CON_EXCEPCION_DESCUENTO: readonly string[] = ['OBRAS_NAC'];
export const ROLES_QUE_AUTORIZAN_EXCEPCION: readonly string[] = ['ADMIN', 'COORDINADOR'];

export function channelAllowsDiscountException(channel: string | null | undefined): boolean {
    return !!channel && CANALES_CON_EXCEPCION_DESCUENTO.includes(channel);
}

export function canAuthorizeDiscountException(role: string | null | undefined, channel: string | null | undefined): boolean {
    return channelAllowsDiscountException(channel) && !!role && ROLES_QUE_AUTORIZAN_EXCEPCION.includes(role);
}

export type DiscountDecision =
    /** Dentro del límite (o sin límite / cuenta con ignorar_limites_descuento). */
    | { kind: 'ok'; pct: number }
    /** Supera el máximo y el usuario puede autorizar la excepción (pide motivo). */
    | { kind: 'needs_authorization'; requestedPct: number; maxPct: number }
    /** Supera el máximo y se recorta; `canRequest` indica si puede registrar una solicitud. */
    | { kind: 'capped'; pct: number; requestedPct: number; maxPct: number; canRequest: boolean };

export function resolveDiscountChange(input: {
    requestedPct: number;
    maxPct: number | null | undefined;
    channel: string | null | undefined;
    role: string | null | undefined;
    ignorarLimites?: boolean;
}): DiscountDecision {
    const requested = Math.max(0, Math.min(100, Number.isFinite(input.requestedPct) ? input.requestedPct : 0));
    const max = Number(input.maxPct) || 0;

    if (input.ignorarLimites || !max || requested <= max) {
        return { kind: 'ok', pct: requested };
    }
    if (canAuthorizeDiscountException(input.role, input.channel)) {
        return { kind: 'needs_authorization', requestedPct: requested, maxPct: max };
    }
    return {
        kind: 'capped',
        pct: max,
        requestedPct: requested,
        maxPct: max,
        canRequest: channelAllowsDiscountException(input.channel)
    };
}

/**
 * Al cambiar la cantidad se recalcula el máximo y antes se recortaba el descuento.
 * Se conserva si la cuenta ignora límites o si la línea ya tenía una excepción
 * autorizada (descuento por encima del máximo previo en un canal con excepción).
 */
export function shouldKeepDiscountOnQtyChange(input: {
    channel: string | null | undefined;
    ignorarLimites?: boolean;
    currentDiscountPct?: number | null;
    previousMaxPct?: number | null;
}): boolean {
    if (input.ignorarLimites) return true;
    if (!channelAllowsDiscountException(input.channel)) return false;
    const current = Number(input.currentDiscountPct) || 0;
    const prevMax = Number(input.previousMaxPct) || 0;
    return prevMax > 0 && current > prevMax;
}

function formatStamp(date: Date): string {
    return date.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
}

export function buildDiscountExceptionNote(input: {
    type: 'AUTORIZADA' | 'SOLICITUD';
    productLabel: string;
    requestedPct: number;
    maxPct: number;
    userName: string;
    reason: string;
    date?: Date;
}): string {
    const when = formatStamp(input.date ?? new Date());
    const header = input.type === 'AUTORIZADA'
        ? '[Excepción de descuento AUTORIZADA]'
        : '[Solicitud de excepción de descuento]';
    return `${header} ${when} · ${input.productLabel}: ${input.requestedPct}% (máx. ${input.maxPct}%) · ${input.type === 'AUTORIZADA' ? 'Autorizó' : 'Solicitó'}: ${input.userName} · Motivo: ${input.reason.trim()}`;
}

export function appendNote(existing: string | null | undefined, note: string): string {
    const base = (existing || '').trimEnd();
    return base ? `${base}\n${note}` : note;
}
