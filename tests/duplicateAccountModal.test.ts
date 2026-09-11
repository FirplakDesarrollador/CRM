import { describe, expect, it } from "vitest";
import { type DuplicateAccountInfo } from "@/components/cuentas/DuplicateAccountModal";

describe("DuplicateAccountModal Data Formatting", () => {
    it("debe estructurar correctamente la información del duplicado y su propietario", () => {
        const mockDuplicate: DuplicateAccountInfo = {
            account: {
                id: "90487e60-8bb6-4d4a-9fce-5ecb30b5c35d",
                nombre: "ACABADOS & MOBILIARIO S.A.S",
                nit_base: "901806059",
                canal_id: "OBRAS_NAC",
                telefono: "3001234567",
                email: "contacto@acabados.com",
            },
            owner: {
                full_name: "Blanca Ordoñez",
                email: "blanca.ordonez@firplak.com",
            },
            conflicts: ["NIT \"901806059\" ya existe"],
        };

        expect(mockDuplicate.account.nombre).toBe("ACABADOS & MOBILIARIO S.A.S");
        expect(mockDuplicate.account.nit_base).toBe("901806059");
        expect(mockDuplicate.owner?.full_name).toBe("Blanca Ordoñez");
        expect(mockDuplicate.owner?.email).toBe("blanca.ordonez@firplak.com");
        expect(mockDuplicate.conflicts).toContain('NIT "901806059" ya existe');
    });
});
