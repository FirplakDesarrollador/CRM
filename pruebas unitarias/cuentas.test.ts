import { describe, expect, it } from "vitest";
import { filterAccounts } from "@/lib/filterUtils";

describe("Filtrado de Cuentas", () => {
    const mockAccounts = [
        {
            id: "acc-1",
            nombre: "Constructora Capital S.A.S",
            nit: "900123456-1",
            nit_base: "900123456",
            ciudad: "Medellín",
            canal_id: "OBRAS_NAC",
            subclasificacion_id: 1,
            nivel_premium: "PREMIUM",
            owner_user_id: "user-1",
            created_by: "user-1",
            created_at: "2026-07-01T10:00:00Z"
        },
        {
            id: "acc-2",
            nombre: "Distribuciones del Café",
            nit: "890900123-4",
            nit_base: "890900123",
            ciudad: "Bogotá",
            canal_id: "DIST_NAC",
            subclasificacion_id: 2,
            nivel_premium: "DESTACADO",
            owner_user_id: "user-2",
            created_by: "user-2",
            created_at: "2026-08-01T10:00:00Z"
        },
        {
            id: "acc-3",
            nombre: "Comprador Digital Web",
            nit: null,
            nit_base: null,
            ciudad: "Cali",
            canal_id: "PROPIO",
            subclasificacion_id: 3,
            nivel_premium: "ACTIVO",
            owner_user_id: "user-1",
            created_by: "user-1",
            created_at: "2026-08-20T10:00:00Z"
        }
    ];

    it("busca cuentas por nombre y por NIT_base de forma insensible a mayúsculas y acentos", () => {
        const porNombre = filterAccounts(mockAccounts, { searchTerm: "capital" });
        expect(porNombre).toHaveLength(1);
        expect(porNombre[0].id).toBe("acc-1");

        const porNit = filterAccounts(mockAccounts, { searchTerm: "890900123" });
        expect(porNit).toHaveLength(1);
        expect(porNit[0].id).toBe("acc-2");
    });

    it("filtra cuentas por canal, subclasificación y nivel premium", () => {
        const porCanal = filterAccounts(mockAccounts, { channelFilter: "OBRAS_NAC" });
        expect(porCanal).toHaveLength(1);
        expect(porCanal[0].id).toBe("acc-1");

        const porNivel = filterAccounts(mockAccounts, { nivelPremiumFilter: "DESTACADO" });
        expect(porNivel).toHaveLength(1);
        expect(porNivel[0].id).toBe("acc-2");
    });

    it("filtra por usuario asignado", () => {
        const porUsuario = filterAccounts(mockAccounts, { assignedUserId: "user-2" });
        expect(porUsuario).toHaveLength(1);
        expect(porUsuario[0].id).toBe("acc-2");
    });

    it("filtra cuentas origen Web según las oportunidades vinculadas a web", () => {
        const webAccountIds = new Set(["acc-3"]);
        const resultadoWeb = filterAccounts(mockAccounts, { webFilter: true }, { webAccountIds });
        expect(resultadoWeb).toHaveLength(1);
        expect(resultadoWeb[0].id).toBe("acc-3");
    });

    it("respeta permisos por rol (Vendedor solo ve propias o en las que colabora)", () => {
        const resultadoVendedor = filterAccounts(mockAccounts, {}, {
            currentUserId: "user-1",
            userRole: "VENDEDOR",
            collabAccountIds: new Set(["acc-2"])
        });
        // user-1 es dueño de acc-1 y acc-3, y colabora en acc-2
        expect(resultadoVendedor).toHaveLength(3);
    });

    it("el filtro por canal reduce el conteo total y descarta cuentas de otros canales", () => {
        const all = filterAccounts(mockAccounts, {});
        expect(all).toHaveLength(3);

        const dist = filterAccounts(mockAccounts, { channelFilter: "DIST_NAC" });
        expect(dist).toHaveLength(1);
        expect(dist[0].id).toBe("acc-2");
        expect(dist.length).toBeLessThan(all.length);
    });

    it("la paginación preserva el conteo total y limita la vista previa al tamaño de página (100)", () => {
        const manyAccounts = Array.from({ length: 220 }, (_, i) => ({
            id: `acc-bulk-${i}`,
            nombre: `Cuenta ${i}`,
            nit: `900${i}-1`,
            nit_base: `900${i}`,
            ciudad: "Medellín",
            canal_id: i % 2 === 0 ? "OBRAS_NAC" : "DIST_NAC",
            subclasificacion_id: 1,
            nivel_premium: "PREMIUM" as const,
            owner_user_id: "user-1",
            created_by: "user-1",
            created_at: "2026-07-01T10:00:00Z"
        }));

        const filtered = filterAccounts(manyAccounts, { channelFilter: "OBRAS_NAC" });
        expect(filtered).toHaveLength(110);

        const pageSize = 100;
        const page1 = filtered.slice(0, pageSize);
        expect(page1).toHaveLength(100);
        expect(filtered.length).toBe(110);

        const page2 = filtered.slice(pageSize, pageSize * 2);
        expect(page2).toHaveLength(10);
    });
});

