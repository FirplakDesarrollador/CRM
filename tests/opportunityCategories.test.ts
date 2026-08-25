import { describe, expect, it } from "vitest";
import {
    OPPORTUNITY_CATEGORIES,
    parseOpportunityCategories,
    formatOpportunityCategories,
} from "@/lib/opportunityCategories";

describe("opportunityCategories", () => {
    it("contiene las categorías canónicas de oportunidad de Firplak", () => {
        const values = OPPORTUNITY_CATEGORIES.map(c => c.value);
        expect(values).toContain("Baños");
        expect(values).toContain("Cocinas");
        expect(values).toContain("Zona de Labores");
        expect(values).toContain("Hidromasajes");
        expect(values).toContain("Institucional");
    });

    describe("parseOpportunityCategories", () => {
        it("parsea strings separados por coma a array", () => {
            expect(parseOpportunityCategories("Baños, Cocinas, Hidromasajes")).toEqual([
                "Baños",
                "Cocinas",
                "Hidromasajes",
            ]);
        });

        it("maneja arrays existentes limpiando espacios", () => {
            expect(parseOpportunityCategories(["  Baños ", "Cocinas "])).toEqual([
                "Baños",
                "Cocinas",
            ]);
        });

        it("maneja null, undefined y strings vacíos devolviendo array vacío", () => {
            expect(parseOpportunityCategories(null)).toEqual([]);
            expect(parseOpportunityCategories(undefined)).toEqual([]);
            expect(parseOpportunityCategories("")).toEqual([]);
            expect(parseOpportunityCategories("   ")).toEqual([]);
        });
    });

    describe("formatOpportunityCategories", () => {
        it("formatea array de categorías a string separado por comas", () => {
            expect(formatOpportunityCategories(["Baños", "Cocinas"])).toBe("Baños, Cocinas");
        });

        it("ignora valores vacíos o espacios", () => {
            expect(formatOpportunityCategories(["Baños", "", "  ", "Cocinas"])).toBe("Baños, Cocinas");
        });

        it("devuelve string vacío si recibe null, undefined o array vacío", () => {
            expect(formatOpportunityCategories([])).toBe("");
            expect(formatOpportunityCategories(null)).toBe("");
            expect(formatOpportunityCategories(undefined)).toBe("");
        });
    });
});
