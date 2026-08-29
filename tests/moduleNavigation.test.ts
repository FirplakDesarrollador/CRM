import { describe, expect, it } from "vitest";
import {
    SYSTEM_NAV_ITEMS,
    getVisibleNavItems,
    sanitizeStateForSessionStorage,
    resolveEditingEntityId
} from "@/lib/navigationRules";

describe("Validación de Navegación, Desacople de Estado y Restricciones de Acceso", () => {
    describe("Aislamiento de IDs en SessionStorage (Sanitización de Filtros)", () => {
        it("remueve el parámetro 'id' al persistir el estado de Cuentas pero conserva los filtros", () => {
            const rawQuery = "id=cuenta-123&channel=DIST_NAC&user=asesor-456&search=constructora";
            const sanitized = sanitizeStateForSessionStorage(rawQuery);

            expect(sanitized).not.toContain("id=cuenta-123");
            expect(sanitized).toContain("channel=DIST_NAC");
            expect(sanitized).toContain("user=asesor-456");
            expect(sanitized).toContain("search=constructora");
        });

        it("remueve el parámetro 'id' al persistir el estado de Contactos", () => {
            const rawQuery = "id=contacto-789&account=cuenta-123&principal=principal";
            const sanitized = sanitizeStateForSessionStorage(rawQuery);

            expect(sanitized).not.toContain("id=contacto-789");
            expect(sanitized).toContain("account=cuenta-123");
            expect(sanitized).toContain("principal=principal");
        });

        it("remueve el parámetro 'id' al persistir el estado de Actividades", () => {
            const rawQuery = "id=actividad-999&view=month&status=pending&type=visita";
            const sanitized = sanitizeStateForSessionStorage(rawQuery);

            expect(sanitized).not.toContain("id=actividad-999");
            expect(sanitized).toContain("view=month");
            expect(sanitized).toContain("status=pending");
            expect(sanitized).toContain("type=visita");
        });

        it("retorna string vacío si solo existía el parámetro 'id'", () => {
            const rawQuery = "id=cuenta-123";
            const sanitized = sanitizeStateForSessionStorage(rawQuery);
            expect(sanitized).toBe("");
        });
    });

    describe("Desacople Unidireccional de Formularios según la URL", () => {
        it("retorna el ID de la entidad cuando la URL lo incluye", () => {
            expect(resolveEditingEntityId("?id=acc-100&tab=info")).toBe("acc-100");
        });

        it("retorna null cuando la URL es limpia (ej. clic en Sidebar /cuentas)", () => {
            expect(resolveEditingEntityId("/cuentas")).toBeNull();
            expect(resolveEditingEntityId("")).toBeNull();
            expect(resolveEditingEntityId("?channel=DIST_NAC")).toBeNull();
        });
    });

    describe("Restricciones de Acceso y Visibilidad por Rol", () => {
        it("permite a un usuario ADMIN ver todos los módulos incluyendo Inventarios, Informes y Usuarios", () => {
            const visible = getVisibleNavItems(SYSTEM_NAV_ITEMS, 'ADMIN');
            const hrefs = visible.map(i => i.href);

            expect(hrefs).toContain("/inventarios");
            expect(hrefs).toContain("/informes");
            expect(hrefs).toContain("/usuarios");
            expect(visible.length).toBe(SYSTEM_NAV_ITEMS.length);
        });

        it("oculta módulos restringidos a un usuario con rol ASESOR", () => {
            const visible = getVisibleNavItems(SYSTEM_NAV_ITEMS, 'ASESOR');
            const hrefs = visible.map(i => i.href);

            expect(hrefs).not.toContain("/inventarios");
            expect(hrefs).not.toContain("/informes");
            expect(hrefs).not.toContain("/usuarios");
            expect(hrefs).toContain("/cuentas");
            expect(hrefs).toContain("/oportunidades");
            expect(hrefs).toContain("/contactos");
            expect(hrefs).toContain("/actividades");
        });

        it("oculta módulos restringidos cuando no hay rol definido (usuario no autenticado)", () => {
            const visible = getVisibleNavItems(SYSTEM_NAV_ITEMS, null);
            const hrefs = visible.map(i => i.href);

            expect(hrefs).not.toContain("/inventarios");
            expect(hrefs).not.toContain("/informes");
            expect(hrefs).not.toContain("/usuarios");
        });
    });
});
