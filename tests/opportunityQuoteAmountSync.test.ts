import { describe, expect, it } from "vitest";
import {
    resolveActiveQuote,
    shouldUpdateOpportunityAmount,
    getOpportunityAmountFromQuote
} from "@/lib/opportunityQuoteSync";

describe("Sincronización de Cotizaciones y Valor de la Oportunidad", () => {
    const quoteDraftA = {
        id: "quote-1",
        opportunity_id: "opp-1",
        numero_cotizacion: "COT-001",
        total_amount: 5000000,
        status: "DRAFT",
        is_winner: false,
        updated_at: "2026-09-10T10:00:00Z"
    };

    const quoteDraftB = {
        id: "quote-2",
        opportunity_id: "opp-1",
        numero_cotizacion: "COT-002",
        total_amount: 13000000,
        status: "DRAFT",
        is_winner: false,
        updated_at: "2026-09-11T15:00:00Z"
    };

    const quoteWinner = {
        id: "quote-winner",
        opportunity_id: "opp-1",
        numero_cotizacion: "COT-WIN",
        total_amount: 18000000,
        status: "WINNER",
        is_winner: true,
        updated_at: "2026-09-12T12:00:00Z"
    };

    describe("resolveActiveQuote", () => {
        it("prioriza la selección explícita del usuario cuando existe selectedQuoteId", () => {
            const active = resolveActiveQuote([quoteDraftA, quoteDraftB, quoteWinner], 18000000, "quote-1");
            expect(active?.id).toBe("quote-1");
        });

        it("prioriza la cotización WINNER si no hay selección explícita", () => {
            const active = resolveActiveQuote([quoteDraftA, quoteDraftB, quoteWinner], 5000000);
            expect(active?.id).toBe("quote-winner");
            expect(active?.total_amount).toBe(18000000);
        });

        it("si no hay WINNER, prioriza la cotización que coincide con el importe de la oportunidad", () => {
            const active = resolveActiveQuote([quoteDraftA, quoteDraftB], 5000000);
            expect(active?.id).toBe("quote-1");
            expect(active?.total_amount).toBe(5000000);
        });

        it("si no hay WINNER ni coincidencia exacta, toma la cotización más reciente", () => {
            const active = resolveActiveQuote([quoteDraftA, quoteDraftB], 9999999);
            expect(active?.id).toBe("quote-2");
            expect(active?.total_amount).toBe(13000000);
        });
    });

    describe("shouldUpdateOpportunityAmount", () => {
        it("permite actualizar la oportunidad si la cotización que cambia es WINNER", () => {
            const shouldUpdate = shouldUpdateOpportunityAmount(
                quoteWinner,
                { total_amount: 20000000 },
                [quoteDraftA, quoteWinner]
            );
            expect(shouldUpdate).toBe(true);
        });

        it("permite actualizar la oportunidad cuando todas las cotizaciones están en DRAFT y no hay WINNER", () => {
            const shouldUpdate = shouldUpdateOpportunityAmount(
                quoteDraftA,
                { total_amount: 7500000 },
                [quoteDraftA, quoteDraftB]
            );
            expect(shouldUpdate).toBe(true);
        });

        it("bloquea actualización si se edita un DRAFT cuando ya existe otra cotización WINNER en la oportunidad", () => {
            const shouldUpdate = shouldUpdateOpportunityAmount(
                quoteDraftA,
                { total_amount: 6000000 },
                [quoteDraftA, quoteWinner]
            );
            expect(shouldUpdate).toBe(false);
        });
    });

    describe("getOpportunityAmountFromQuote", () => {
        it("extrae correctamente el nuevo monto desde updates.total_amount", () => {
            const amount = getOpportunityAmountFromQuote(quoteDraftA, { total_amount: 8500000 });
            expect(amount).toBe(8500000);
        });

        it("recurre a quote.total_amount si updates no trae total_amount", () => {
            const amount = getOpportunityAmountFromQuote(quoteDraftB, {});
            expect(amount).toBe(13000000);
        });
    });
});
