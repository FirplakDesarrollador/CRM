import { describe, expect, it } from "vitest";
import { filterOpportunities } from "@/lib/filterUtils";

describe("Filtrado de Oportunidades", () => {
    const mockAccounts = new Map([
        ["acc-1", { id: "acc-1", nombre: "Constructora Bolivar", canal_id: "OBRAS_NAC", subclasificacion_id: 10 }],
        ["acc-2", { id: "acc-2", nombre: "Distribuidora del Norte", canal_id: "DIST_NAC", subclasificacion_id: 20 }],
        ["acc-3", { id: "acc-3", nombre: "Cliente Directo Web", canal_id: "PROPIO", subclasificacion_id: 30 }]
    ]);

    const mockOpps = [
        {
            id: "opp-1",
            nombre: "Torre 1 Baños",
            account_id: "acc-1",
            amount: 50000000,
            fase_id: 1, // Prospección
            estado_id: 1, // Abierta
            owner_user_id: "user-vendedor-1",
            created_by: "user-vendedor-1",
            created_at: "2026-08-01T10:00:00Z",
            fecha_cierre_estimada: "2026-09-30",
            segmento_id: 101,
            origen_oportunidad: "Feria",
            url_origen: null
        },
        {
            id: "opp-2",
            nombre: "Dotación Grifería",
            account_id: "acc-2",
            amount: 15000000,
            fase_id: 5, // Ganada
            estado_id: 2, // Ganada
            owner_user_id: "user-vendedor-2",
            created_by: "user-vendedor-2",
            created_at: "2026-08-15T12:00:00Z",
            fecha_cierre_estimada: "2026-08-28",
            segmento_id: 201,
            origen_oportunidad: "WhatsApp",
            url_origen: null
        },
        {
            id: "opp-3",
            nombre: "Compra Web Tina Hidromasajes",
            account_id: "acc-3",
            amount: 8000000,
            fase_id: 6, // Perdida
            estado_id: 3, // Perdida
            owner_user_id: "user-vendedor-1",
            created_by: "user-vendedor-1",
            created_at: "2026-08-20T15:00:00Z",
            fecha_cierre_estimada: "2026-08-25",
            segmento_id: 301,
            origen_oportunidad: "Página Web",
            url_origen: "https://firplak.com/tinas"
        }
    ];

    it("filtra correctamente por canal y subclasificación jerárquica", () => {
        const result = filterOpportunities(mockOpps, {
            channelFilter: "OBRAS_NAC",
            subclassificationFilter: 10
        }, { accountsMap: mockAccounts });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("opp-1");
    });

    it("filtra por estado de oportunidad (won, lost, open)", () => {
        const wonPhases = [5];
        const lostPhases = [6];
        const closedPhases = [5, 6];

        const openOpps = filterOpportunities(mockOpps, { statusFilter: "open" }, {
            wonPhaseIds: wonPhases,
            lostPhaseIds: lostPhases,
            closedPhaseIds: closedPhases
        });
        expect(openOpps).toHaveLength(1);
        expect(openOpps[0].id).toBe("opp-1");

        const wonOpps = filterOpportunities(mockOpps, { statusFilter: "won" }, {
            wonPhaseIds: wonPhases,
            lostPhaseIds: lostPhases,
            closedPhaseIds: closedPhases
        });
        expect(wonOpps).toHaveLength(1);
        expect(wonOpps[0].id).toBe("opp-2");

        const lostOpps = filterOpportunities(mockOpps, { statusFilter: "lost" }, {
            wonPhaseIds: wonPhases,
            lostPhaseIds: lostPhases,
            closedPhaseIds: closedPhases
        });
        expect(lostOpps).toHaveLength(1);
        expect(lostOpps[0].id).toBe("opp-3");
    });

    it("filtra por origen 'wp' reconociendo tanto 'wp' como 'whatsapp'", () => {
        const result = filterOpportunities(mockOpps, { originFilter: "wp" });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("opp-2");
    });

    it("filtra pestaña 'web' identificando url_origen y textos relacionados a web o página", () => {
        const result = filterOpportunities(mockOpps, { userFilter: "web" });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("opp-3");
    });

    it("filtra pestaña 'mine' y 'collab' según usuario y colaboraciones", () => {
        const mine = filterOpportunities(mockOpps, { userFilter: "mine" }, {
            currentUserId: "user-vendedor-1",
            userRole: "VENDEDOR"
        });
        expect(mine).toHaveLength(2);

        const collab = filterOpportunities(mockOpps, { userFilter: "collab" }, {
            currentUserId: "user-vendedor-1",
            userRole: "VENDEDOR",
            collabOppIds: new Set(["opp-2"])
        });
        expect(collab).toHaveLength(1);
        expect(collab[0].id).toBe("opp-2");
    });
});
