/**
 * Rango de fechas de la barra superior del listado de oportunidades.
 *
 * En la pestaña Ganadas el rango compara `fecha_cierre_estimada` (columna date,
 * la misma que el filtro avanzado de cierre y la tarjeta "Ventas ganadas mes").
 * Si esa fecha es null, la fila se conserva comparando `created_at`, para no
 * ocultar una ganada sin cierre. Todas, Abiertas y Perdidas siguen en `created_at`.
 */

import { isDateOnlyInRange, toBogotaEndOfDayISO, toBogotaStartOfDayISO, toDateOnly } from './dateFilterHelpers';
import { calculateTotalAmount } from './opportunityColumnFilterHelpers';
import type { OpportunityStatusFilter } from './opportunityStatusFilter';

export function listRangeUsesCloseDate(status: OpportunityStatusFilter | string | null | undefined): boolean {
    return status === 'won';
}

export function listDateFilterTitle(status: string | null | undefined): string {
    return listRangeUsesCloseDate(status) ? 'Fecha de cierre' : 'Fecha de Creación';
}

export function listDateTodayLabel(status: string | null | undefined): string {
    return listRangeUsesCloseDate(status) ? 'Cerradas hoy' : 'Creadas hoy';
}

type DatedOpportunity = {
    created_at?: string | null;
    fecha_cierre_estimada?: string | null;
};

function matchesCreatedAtRange(
    createdAt: string | null | undefined,
    startDate: string | null | undefined,
    endDate: string | null | undefined,
): boolean {
    if (!createdAt) return false;
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) return false;
    if (startDate) {
        const startISO = toBogotaStartOfDayISO(startDate);
        if (startISO && createdMs < new Date(startISO).getTime()) return false;
    }
    if (endDate) {
        const endISO = toBogotaEndOfDayISO(endDate);
        if (endISO && createdMs > new Date(endISO).getTime()) return false;
    }
    return true;
}

/** Misma regla para el listado en memoria (Dexie) y para los totales de ese conjunto. */
export function matchesOpportunityListDateRange(
    opp: DatedOpportunity,
    status: OpportunityStatusFilter | string | null | undefined,
    startDate: string | null | undefined,
    endDate: string | null | undefined,
): boolean {
    if (!startDate && !endDate) return true;
    if (listRangeUsesCloseDate(status)) {
        const closeDay = toDateOnly(opp.fecha_cierre_estimada);
        if (closeDay) return isDateOnlyInRange(closeDay, startDate, endDate);
        return matchesCreatedAtRange(opp.created_at, startDate, endDate);
    }
    return matchesCreatedAtRange(opp.created_at, startDate, endDate);
}

export function summarizeOpportunityListDateRange<T extends DatedOpportunity & { amount?: number | string | null }>(
    opportunities: T[],
    status: OpportunityStatusFilter | string | null | undefined,
    startDate: string | null | undefined,
    endDate: string | null | undefined,
): { count: number; totalAmount: number; rows: T[] } {
    const rows = opportunities.filter((opp) => matchesOpportunityListDateRange(opp, status, startDate, endDate));
    return {
        count: rows.length,
        totalAmount: calculateTotalAmount(rows),
        rows,
    };
}

/** Valores PostgREST con `:` o `.` (timestamps ISO) van entre comillas. */
function quotePostgrestValue(value: string): string {
    if (/[,.:()"\\\s]/.test(value)) {
        return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
}

/**
 * Condición `.or(...)` de Ganadas:
 * cierre dentro del rango, o cierre null y created_at dentro del rango.
 * Devuelve null si no hay un día YYYY-MM-DD utilizable.
 */
export function buildWonCloseDateOrFilter(
    startDate: string | null | undefined,
    endDate: string | null | undefined,
): string | null {
    const startDay = toDateOnly(startDate);
    const endDay = toDateOnly(endDate);
    if (!startDay && !endDay) return null;

    const closeConds: string[] = [];
    const createdConds: string[] = ['fecha_cierre_estimada.is.null'];

    if (startDay) {
        closeConds.push(`fecha_cierre_estimada.gte.${startDay}`);
        const startISO = toBogotaStartOfDayISO(startDay);
        if (startISO) createdConds.push(`created_at.gte.${quotePostgrestValue(startISO)}`);
    }
    if (endDay) {
        closeConds.push(`fecha_cierre_estimada.lte.${endDay}`);
        const endISO = toBogotaEndOfDayISO(endDay);
        if (endISO) createdConds.push(`created_at.lte.${quotePostgrestValue(endISO)}`);
    }

    const closeGroup = closeConds.length === 1 ? closeConds[0] : `and(${closeConds.join(',')})`;
    const createdGroup = createdConds.length === 1 ? createdConds[0] : `and(${createdConds.join(',')})`;
    return `${closeGroup},${createdGroup}`;
}
