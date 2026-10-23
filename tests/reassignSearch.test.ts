import { describe, expect, it } from "vitest";
import { matchesSearchTokens } from "@/lib/utils";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";

describe("Reassign Activity Search & Options", () => {
    const mockUsers = [
        { id: "u-1", full_name: "Alejandro Isaza", email: "isaza@firplak.com" },
        { id: "u-2", full_name: "Felix Contreras", email: "fcontreras@firplak.com" },
        { id: "u-3", full_name: "Maria Perez", email: "mperez@firplak.com" }
    ];

    it("genera opciones para SearchableSelect con soporte de búsqueda por nombre y correo", () => {
        const options: SearchableSelectOption[] = mockUsers.map(u => ({
            value: u.id,
            label: u.full_name || u.email,
            searchValue: `${u.full_name || ''} ${u.email || ''}`
        }));

        expect(options).toHaveLength(3);
        expect(options[0]).toEqual({
            value: "u-1",
            label: "Alejandro Isaza",
            searchValue: "Alejandro Isaza isaza@firplak.com"
        });

        // Búsqueda por nombre
        expect(matchesSearchTokens(options[0].searchValue || options[0].label, "Alejandro")).toBe(true);
        // Búsqueda insensible a mayúsculas y acentos
        expect(matchesSearchTokens(options[0].searchValue || options[0].label, "alejandro")).toBe(true);
        // Búsqueda por correo
        expect(matchesSearchTokens(options[0].searchValue || options[0].label, "isaza@firplak")).toBe(true);
        // Búsqueda de término que no existe
        expect(matchesSearchTokens(options[0].searchValue || options[0].label, "carlos")).toBe(false);
    });

    it("encuentra usuario aunque los tokens estén en orden invertido o sin tildes", () => {
        const option = {
            value: "u-1",
            label: "Alejandro Ramón Isaza",
            searchValue: "Alejandro Ramón Isaza isaza@firplak.com"
        };

        expect(matchesSearchTokens(option.searchValue, "ramon isaza")).toBe(true);
        expect(matchesSearchTokens(option.searchValue, "isaza alejandro")).toBe(true);
    });
});
