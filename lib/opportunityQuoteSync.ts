export interface SyncQuoteLike {
    id: string;
    opportunity_id?: string;
    numero_cotizacion?: string;
    total_amount?: number;
    status?: string;
    is_winner?: boolean;
    is_deleted?: boolean;
    updated_at?: string;
}

/**
 * Resuelve la cotización activa para una oportunidad considerando:
 * 1. Selección explícita del usuario (selectedQuoteId)
 * 2. Cotización ganadora (WINNER / is_winner)
 * 3. Cotización cuyo total_amount coincide con el importe actual de la oportunidad
 * 4. Cotización con updated_at más reciente
 */
export function resolveActiveQuote<T extends SyncQuoteLike>(
    quotes: T[] | null | undefined,
    currentOpportunityAmount?: number,
    selectedQuoteId?: string | null
): T | undefined {
    if (!quotes || quotes.length === 0) return undefined;

    const availableQuotes = quotes.filter(q => !q.is_deleted);
    if (availableQuotes.length === 0) return undefined;

    // 1. Selección explícita
    if (selectedQuoteId) {
        const selected = availableQuotes.find(q => q.id === selectedQuoteId);
        if (selected) return selected;
    }

    // Ordenar de más reciente a más antigua
    const sortedQuotes = [...availableQuotes].sort((a, b) =>
        new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );

    // 2. Cotización ganadora
    const winnerQuote = sortedQuotes.find(q => q.status === 'WINNER' || q.is_winner);
    if (winnerQuote) return winnerQuote;

    // 3. Coincidencia exacta de importe con la oportunidad
    if (currentOpportunityAmount !== undefined && currentOpportunityAmount !== null) {
        const matchingQuote = sortedQuotes.find(q =>
            Math.abs((q.total_amount || 0) - currentOpportunityAmount) < 0.01
        );
        if (matchingQuote) return matchingQuote;
    }

    // 4. La más reciente
    return sortedQuotes[0];
}

/**
 * Determina si la actualización de una cotización debe propagarse al monto de la oportunidad padre:
 * - Si la cotización es WINNER: SÍ.
 * - Si ya existe otra cotización WINNER distinta en la oportunidad: NO (la ganadora manda).
 * - Si no hay ninguna cotización WINNER en la oportunidad: SÍ.
 */
export function shouldUpdateOpportunityAmount<T extends SyncQuoteLike>(
    quote: T,
    updates: Partial<T>,
    allQuotesForOpportunity: T[]
): boolean {
    const isThisWinner = updates.status === 'WINNER' || updates.is_winner || quote.status === 'WINNER' || quote.is_winner;
    if (isThisWinner) return true;

    const hasOtherWinner = (allQuotesForOpportunity || []).some(
        q => q.id !== quote.id && !q.is_deleted && (q.status === 'WINNER' || q.is_winner)
    );

    if (hasOtherWinner) return false;

    return true;
}

/**
 * Obtiene el monto numérico a asignar a la oportunidad desde una cotización y sus cambios.
 */
export function getOpportunityAmountFromQuote<T extends SyncQuoteLike>(
    quote: T,
    updates?: Partial<T>
): number {
    if (updates && updates.total_amount !== undefined && updates.total_amount !== null) {
        return Number(updates.total_amount) || 0;
    }
    return Number(quote?.total_amount) || 0;
}
