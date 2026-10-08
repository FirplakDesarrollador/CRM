import { describe, expect, it } from "vitest";
import { DashboardFilterState } from "@/components/dashboard/DashboardFilters";

// Helper function implementing the dashboard filtering logic for testing
export function filterDashboardData(
    opportunities: Array<{
        id: string;
        nombre: string;
        account_id: string;
        amount: number;
        origen_oportunidad?: string | null;
        owner_user_id?: string | null;
        created_at?: string | null;
    }>,
    accounts: Array<{
        id: string;
        nombre: string;
        canal_id?: string | null;
        subclasificacion_id?: number | null;
        nivel_premium?: string | null;
        owner_user_id?: string | null;
        origen_cuenta?: string | null;
        created_at?: string | null;
    }>,
    filters: DashboardFilterState
) {
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const filteredOpps = opportunities.filter((o) => {
        if (filters.advisor_id && o.owner_user_id !== filters.advisor_id) return false;

        const acc = accountMap.get(o.account_id);
        if (filters.canal_id && acc?.canal_id !== filters.canal_id) return false;
        if (filters.subclasificacion_id && acc?.subclasificacion_id !== filters.subclasificacion_id) return false;
        if (filters.nivel_premium && acc?.nivel_premium !== filters.nivel_premium) return false;

        // Origin filter
        if (filters.origen_oportunidad) {
            if (!o.origen_oportunidad) return false;
            const lowerOrigin = filters.origen_oportunidad.toLowerCase();
            const val = o.origen_oportunidad.toLowerCase();
            if (lowerOrigin === "wp") {
                if (!val.includes("wp") && !val.includes("whatsapp")) return false;
            } else if (!val.includes(lowerOrigin)) {
                return false;
            }
        }

        if (filters.search_query) {
            const query = filters.search_query.toLowerCase();
            const oppNameMatch = o.nombre?.toLowerCase().includes(query) || false;
            const accNameMatch = acc?.nombre?.toLowerCase().includes(query) || false;
            if (!oppNameMatch && !accNameMatch) return false;
        }

        return true;
    });

    const filteredAccs = accounts.filter((a) => {
        if (filters.canal_id && a.canal_id !== filters.canal_id) return false;
        if (filters.subclasificacion_id && a.subclasificacion_id !== filters.subclasificacion_id) return false;
        if (filters.nivel_premium && a.nivel_premium !== filters.nivel_premium) return false;
        if (filters.advisor_id && a.owner_user_id !== filters.advisor_id) return false;

        if (filters.origen_oportunidad) {
            if (!a.origen_cuenta) return false;
            const lowerOrigin = filters.origen_oportunidad.toLowerCase();
            const val = a.origen_cuenta.toLowerCase();
            if (lowerOrigin === "wp") {
                if (!val.includes("wp") && !val.includes("whatsapp")) return false;
            } else if (!val.includes(lowerOrigin)) {
                return false;
            }
        }

        return true;
    });

    return { opportunities: filteredOpps, accounts: filteredAccs };
}

describe("Dashboard Filters - Origen de Oportunidad", () => {
    const mockAccounts = [
        { id: "acc-1", nombre: "Constructora Alfa", canal_id: "OBRAS_NAC", origen_cuenta: "Feria" },
        { id: "acc-2", nombre: "Comercial Beta", canal_id: "DIST_NAC", origen_cuenta: "WhatsApp" },
        { id: "acc-3", nombre: "Cliente Gamma", canal_id: "PROPIO", origen_cuenta: "Visita" }
    ];

    const mockOpps = [
        { id: "opp-1", nombre: "Torre 1", account_id: "acc-1", amount: 1000, origen_oportunidad: "Feria" },
        { id: "opp-2", nombre: "Casa 2", account_id: "acc-2", amount: 2000, origen_oportunidad: "WhatsApp" },
        { id: "opp-3", nombre: "Apartamento 3", account_id: "acc-2", amount: 1500, origen_oportunidad: "wp" },
        { id: "opp-4", nombre: "Local 4", account_id: "acc-3", amount: 3000, origen_oportunidad: "Visita" },
        { id: "opp-5", nombre: "Sin Origen", account_id: "acc-1", amount: 500, origen_oportunidad: null }
    ];

    it("filtra oportunidades correctamente por origen 'feria'", () => {
        const filters: DashboardFilterState = {
            canal_id: null,
            advisor_id: null,
            subclasificacion_id: null,
            nivel_premium: null,
            origen_oportunidad: "feria",
            search_query: null,
            date_from: null,
            date_to: null
        };

        const result = filterDashboardData(mockOpps, mockAccounts, filters);
        expect(result.opportunities).toHaveLength(1);
        expect(result.opportunities[0].id).toBe("opp-1");
        expect(result.accounts).toHaveLength(1);
        expect(result.accounts[0].id).toBe("acc-1");
    });

    it("filtra correctamente con alias de whatsapp ('wp')", () => {
        const filters: DashboardFilterState = {
            canal_id: null,
            advisor_id: null,
            subclasificacion_id: null,
            nivel_premium: null,
            origen_oportunidad: "wp",
            search_query: null,
            date_from: null,
            date_to: null
        };

        const result = filterDashboardData(mockOpps, mockAccounts, filters);
        expect(result.opportunities).toHaveLength(2);
        expect(result.opportunities.map(o => o.id)).toEqual(["opp-2", "opp-3"]);
        expect(result.accounts).toHaveLength(1);
        expect(result.accounts[0].id).toBe("acc-2");
    });

    it("no filtra si origen_oportunidad es null", () => {
        const filters: DashboardFilterState = {
            canal_id: null,
            advisor_id: null,
            subclasificacion_id: null,
            nivel_premium: null,
            origen_oportunidad: null,
            search_query: null,
            date_from: null,
            date_to: null
        };

        const result = filterDashboardData(mockOpps, mockAccounts, filters);
        expect(result.opportunities).toHaveLength(5);
        expect(result.accounts).toHaveLength(3);
    });
});
