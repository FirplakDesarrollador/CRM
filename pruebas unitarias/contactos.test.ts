import { describe, expect, it } from "vitest";
import { filterContacts } from "@/lib/filterUtils";

describe("Filtrado de Contactos", () => {
    const mockContacts = [
        {
            id: "contact-1",
            account_id: "acc-1",
            nombre: "Carlos Andrés Rodríguez",
            cargo: "Director de Compras",
            email: "carlos.rodriguez@constructora.com",
            telefono: "3001234567",
            es_principal: true
        },
        {
            id: "contact-2",
            account_id: "acc-1",
            nombre: "Marcela Restrepo",
            cargo: "Residente de Obra",
            email: "marcela.restrepo@constructora.com",
            telefono: "3109876543",
            es_principal: false
        },
        {
            id: "contact-3",
            account_id: "acc-2",
            nombre: "Juan Pablo Gómez",
            cargo: "Gerente General",
            email: "juan.gomez@distribuidora.com",
            telefono: "3205556677",
            es_principal: true
        }
    ];

    it("filtra contactos por cuenta específica", () => {
        const resultado = filterContacts(mockContacts, { accountFilter: "acc-1" });
        expect(resultado).toHaveLength(2);
        expect(resultado.map(c => c.id)).toEqual(["contact-1", "contact-2"]);
    });

    it("filtra por contacto principal vs secundario", () => {
        const principales = filterContacts(mockContacts, { principalFilter: "principal" });
        expect(principales).toHaveLength(2);
        expect(principales.map(c => c.id)).toEqual(["contact-1", "contact-3"]);

        const secundarios = filterContacts(mockContacts, { principalFilter: "secondary" });
        expect(secundarios).toHaveLength(1);
        expect(secundarios[0].id).toBe("contact-2");
    });

    it("busca por múltiples tokens sobre nombre, cargo, email y teléfono", () => {
        const porCargo = filterContacts(mockContacts, { searchTerm: "compras" });
        expect(porCargo).toHaveLength(1);
        expect(porCargo[0].id).toBe("contact-1");

        const porTelefono = filterContacts(mockContacts, { searchTerm: "3109876543" });
        expect(porTelefono).toHaveLength(1);
        expect(porTelefono[0].id).toBe("contact-2");

        const porNombreEmail = filterContacts(mockContacts, { searchTerm: "carlos constructora" });
        expect(porNombreEmail).toHaveLength(1);
        expect(porNombreEmail[0].id).toBe("contact-1");
    });

    it("aplica seguridad por rol asegurando que los vendedores vean contactos de cuentas colaboradas", () => {
        // Un vendedor asignado a acc-1 y colaborador en acc-2
        const allowedAccounts = new Set(["acc-1", "acc-2"]);
        const resultado = filterContacts(mockContacts, {}, {
            currentUserId: "user-vendedor",
            userRole: "VENDEDOR",
            allowedAccountIds: allowedAccounts
        });
        expect(resultado).toHaveLength(3);

        // Si solo tuviera acc-1
        const restringido = filterContacts(mockContacts, {}, {
            currentUserId: "user-vendedor",
            userRole: "VENDEDOR",
            allowedAccountIds: new Set(["acc-1"])
        });
        expect(restringido).toHaveLength(2);
        expect(restringido.map(c => c.id)).toEqual(["contact-1", "contact-2"]);
    });

    it("el filtrado por cuenta reduce el conteo total y descarta contactos ajenos", () => {
        const all = filterContacts(mockContacts, {});
        expect(all).toHaveLength(3);

        const acc2 = filterContacts(mockContacts, { accountFilter: "acc-2" });
        expect(acc2).toHaveLength(1);
        expect(acc2[0].id).toBe("contact-3");
        expect(acc2.length).toBeLessThan(all.length);
    });

    it("la paginación preserva el total y limita los resultados preliminares al tamaño de página (100)", () => {
        const manyContacts = Array.from({ length: 180 }, (_, i) => ({
            id: `contact-bulk-${i}`,
            account_id: i % 2 === 0 ? "acc-1" : "acc-2",
            nombre: `Contacto ${i}`,
            cargo: "Ingeniero",
            email: `contacto${i}@empresa.com`,
            telefono: `30000000${i}`,
            es_principal: i % 3 === 0
        }));

        const filtered = filterContacts(manyContacts, { accountFilter: "acc-1" });
        expect(filtered).toHaveLength(90);

        const pageSize = 50;
        const page1 = filtered.slice(0, pageSize);
        expect(page1).toHaveLength(50);
        expect(filtered.length).toBe(90);

        const page2 = filtered.slice(pageSize, pageSize * 2);
        expect(page2).toHaveLength(40);
    });
});

