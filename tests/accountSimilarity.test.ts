import { describe, expect, it } from "vitest";
import {
    normalizeAccountName,
    buildBranchAccountName,
    resolveRootAccountTarget,
    evaluateSimilarityAlerts,
    buildSimilarityConfirmationMessage,
    type SimilarAccountMatch,
} from "@/lib/accountSimilarity";

const makeMatch = (overrides: Partial<SimilarAccountMatch> = {}): SimilarAccountMatch => ({
    id: "acc-1",
    nombre: "FERRETERIA EL CONSTRUCTOR SAS",
    nit_base: "900123456-7",
    canal_id: "DIST_NAC",
    id_cuenta_principal: null,
    root_id: "acc-1",
    root_nombre: "FERRETERIA EL CONSTRUCTOR SAS",
    root_nit_base: "900123456-7",
    owner_user_id: "user-other",
    owner_name: "Carlos Pérez",
    owner_zona: "Antioquia",
    match_reason: "NOMBRE",
    similarity_score: 0.72,
    ...overrides,
});

describe("Similitud de cuentas y sucursales por zona (lib/accountSimilarity)", () => {
    it("normaliza nombres eliminando tildes, múltiples espacios, puntuación y sufijos societarios", () => {
        expect(normalizeAccountName("  Ferretería   El Constructor S.A.S. ")).toBe("ferreteria el constructor");
        expect(normalizeAccountName("ACABADOS & DISEÑOS LTDA.")).toBe("acabados disenos");
    });

    it("genera el nombre de sucursal respetando el nombre matriz y anexando la zona sin duplicarla", () => {
        expect(buildBranchAccountName("Ferretería El Constructor SAS", "Costa")).toBe(
            "Ferretería El Constructor SAS - Costa"
        );
        expect(buildBranchAccountName("Ferretería El Constructor SAS - Costa", "COSTA")).toBe(
            "Ferretería El Constructor SAS - Costa"
        );
    });

    it("resuelve siempre hacia la cuenta matriz cuando la coincidencia ya es una sucursal", () => {
        const branchMatch = makeMatch({
            id: "acc-branch-1",
            nombre: "FERRETERIA EL CONSTRUCTOR SAS - CENTRO",
            id_cuenta_principal: "acc-root",
            root_id: "acc-root",
            root_nombre: "FERRETERIA EL CONSTRUCTOR SAS",
            root_nit_base: "900123456-7",
        });

        const target = resolveRootAccountTarget(branchMatch);
        expect(target.id).toBe("acc-root");
        expect(target.nombre).toBe("FERRETERIA EL CONSTRUCTOR SAS");
        expect(target.nit_base).toBe("900123456-7");
    });

    it("detecta alerta anti-evasión por nombre alterado (espacios/omisión) y por raíz de NIT", () => {
        const nameMatch = makeMatch({
            nit_base: "800999888-1",
            root_nit_base: "800999888-1",
            similarity_score: 0.61,
            match_reason: "NOMBRE",
        });
        const nitMatch = makeMatch({
            id: "acc-2",
            nombre: "OTRA EMPRESA",
            nit_base: "900123456",
            match_reason: "NIT",
            similarity_score: 0.1,
        });

        const alerts = evaluateSimilarityAlerts({
            inputName: "Ferreteria   Constructor",
            inputNit: "900123456-7",
            matches: [nameMatch, nitMatch],
            isBranchMode: false,
            selectedParentId: null,
        });

        expect(alerts.hasHighNameMatch).toBe(true);
        expect(alerts.topNameMatch?.id).toBe("acc-1");
        expect(alerts.hasNitMatch).toBe(true);
        expect(alerts.topNitMatch?.id).toBe("acc-2");
    });

    it("no muestra alerta de conflicto cuando el asesor ya vinculó la sucursal a esa matriz", () => {
        const match = makeMatch({ id: "acc-root", root_id: "acc-root", match_reason: "AMBOS", similarity_score: 0.85 });

        const alerts = evaluateSimilarityAlerts({
            inputName: "FERRETERIA EL CONSTRUCTOR SAS - Costa",
            inputNit: "900123456-7",
            matches: [match],
            isBranchMode: true,
            selectedParentId: "acc-root",
        });

        expect(alerts.hasHighNameMatch).toBe(false);
        expect(alerts.hasNitMatch).toBe(false);
    });

    it("construye el mensaje de aseguramiento advirtiendo que se notificará a la coordinación comercial", () => {
        const msgByName = buildSimilarityConfirmationMessage({
            matchName: "FERRETERIA EL CONSTRUCTOR SAS",
            ownerName: "Carlos Pérez",
            matchReason: "NOMBRE",
        });
        expect(msgByName).toContain("FERRETERIA EL CONSTRUCTOR SAS");
        expect(msgByName).toContain("Carlos Pérez");
        expect(msgByName).toContain("se notificará a la coordinación comercial");

        const msgByNit = buildSimilarityConfirmationMessage({
            matchName: "FERRETERIA EL CONSTRUCTOR SAS",
            ownerName: "Carlos Pérez",
            matchReason: "NIT",
        });
        expect(msgByNit).toContain("NIT");
        expect(msgByNit).toContain("se notificará a la coordinación comercial");
    });
});
