import { describe, expect, it } from "vitest";
import {
    sanitizeNitInput,
    extractNitRoot,
    validateColombianNit,
    isProvisionalNit,
    isValidRealNit,
} from "@/lib/nitUtils";

describe("NIT colombiano estricto (lib/nitUtils)", () => {
    describe("sanitizeNitInput", () => {
        it("elimina puntos, espacios y letras dejando solo dígitos y máximo un guion con 1 DV", () => {
            expect(sanitizeNitInput("900.123.456-7")).toBe("900123456-7");
            expect(sanitizeNitInput("900 123 456 - 7")).toBe("900123456-7");
            expect(sanitizeNitInput("NIT 890.927.404-0")).toBe("890927404-0");
            expect(sanitizeNitInput("1037654321")).toBe("1037654321");
        });

        it("bloquea un segundo guion y limita el dígito de verificación a 1 solo dígito", () => {
            expect(sanitizeNitInput("900123456-7-8")).toBe("900123456-7");
            expect(sanitizeNitInput("900123456--7")).toBe("900123456-7");
            expect(sanitizeNitInput("900123456-789")).toBe("900123456-7");
        });

        it("no permite guion al inicio y conserva guion pendiente mientras el usuario escribe", () => {
            expect(sanitizeNitInput("-900123456")).toBe("900123456");
            expect(sanitizeNitInput("900123456-")).toBe("900123456-");
        });

        it("limita la raíz numérica a 12 dígitos máximo", () => {
            expect(sanitizeNitInput("123456789012345")).toBe("123456789012");
            expect(sanitizeNitInput("123456789012345-9")).toBe("123456789012-9");
        });
    });

    describe("extractNitRoot", () => {
        it("extrae la raíz numérica ignorando dígito de verificación y separadores", () => {
            expect(extractNitRoot("900123456-7")).toBe("900123456");
            expect(extractNitRoot("900.123.456-7")).toBe("900123456");
            expect(extractNitRoot("900123456")).toBe("900123456");
        });

        it("retorna cadena vacía para NITs provisionales o vacíos", () => {
            expect(extractNitRoot("PROV-A1B2C3D4")).toBe("");
            expect(extractNitRoot("")).toBe("");
            expect(extractNitRoot(null)).toBe("");
        });
    });

    describe("validateColombianNit", () => {
        it("acepta campo vacío, solo dígitos o dígitos con un único guion y DV opcional", () => {
            expect(validateColombianNit("")).toBe(true);
            expect(validateColombianNit(null)).toBe(true);
            expect(validateColombianNit("900123456")).toBe(true);
            expect(validateColombianNit("900123456-7")).toBe(true);
            expect(validateColombianNit("1037654321")).toBe(true);
            expect(isValidRealNit("900123456-7")).toBe(true);
            expect(isProvisionalNit("PROV-1234ABCD")).toBe(true);
        });

        it("rechaza puntos, espacios, doble guion, guion sin dígito final, DV de 2 dígitos y letras", () => {
            expect(validateColombianNit("900.123.456-7")).toBe(false);
            expect(validateColombianNit("900 123 456")).toBe(false);
            expect(validateColombianNit("900123456-7-1")).toBe(false);
            expect(validateColombianNit("900123456-")).toBe(false);
            expect(validateColombianNit("900123456-78")).toBe(false);
            expect(validateColombianNit("1234")).toBe(false);
            expect(validateColombianNit("ABC900123")).toBe(false);
        });
    });
});
