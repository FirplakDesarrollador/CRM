export interface OpportunityProductItem {
    producto_id?: string | null;
    planta?: string | null;
    familia?: string | null;
}

export interface OpportunityWithProducts {
    id: string;
    nombre?: string;
    amount?: number | null;
    quoteItems?: OpportunityProductItem[];
    [key: string]: unknown;
}

export interface ProductFilters {
    planta?: string | null;
    familia?: string | null;
}

export interface FlatQuoteItemProduct {
    opportunity_id?: string | null;
    planta?: string | null;
    familia?: string | null;
}

/**
 * Filtra un arreglo de oportunidades en memoria evaluando los productos de sus cotizaciones.
 * Si no hay filtros activos de planta ni de familia, devuelve la lista intacta.
 * Si hay algún filtro activo, excluye oportunidades sin productos o cuyos productos no coincidan.
 */
export function filterOpportunitiesByProduct<T extends OpportunityWithProducts>(
    opportunities: T[],
    filters: ProductFilters
): T[] {
    const planta = filters.planta?.trim() || null;
    const familia = filters.familia?.trim() || null;

    if (!planta && !familia) {
        return opportunities;
    }

    const lowerPlanta = planta?.toLowerCase();
    const lowerFamilia = familia?.toLowerCase();

    return opportunities.filter(opp => {
        if (!opp.quoteItems || opp.quoteItems.length === 0) {
            return false;
        }

        return opp.quoteItems.some(item => {
            const matchesPlanta = !lowerPlanta || item.planta?.toLowerCase() === lowerPlanta;
            const matchesFamilia = !lowerFamilia || item.familia?.toLowerCase() === lowerFamilia;
            return matchesPlanta && matchesFamilia;
        });
    });
}

/**
 * Extrae los IDs únicos de oportunidades coincidentes con los filtros de planta y familia
 * a partir de un listado plano de items de cotizaciones vinculados a productos.
 */
export function getOpportunityIdsByProductFilters(
    items: FlatQuoteItemProduct[],
    filters: ProductFilters
): string[] {
    const planta = filters.planta?.trim() || null;
    const familia = filters.familia?.trim() || null;

    if (!planta && !familia) {
        return [];
    }

    const lowerPlanta = planta?.toLowerCase();
    const lowerFamilia = familia?.toLowerCase();
    const oppIds = new Set<string>();

    for (const item of items) {
        if (!item.opportunity_id) continue;

        const matchesPlanta = !lowerPlanta || item.planta?.toLowerCase() === lowerPlanta;
        const matchesFamilia = !lowerFamilia || item.familia?.toLowerCase() === lowerFamilia;

        if (matchesPlanta && matchesFamilia) {
            oppIds.add(item.opportunity_id);
        }
    }

    return Array.from(oppIds);
}

