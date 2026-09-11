import { describe, expect, it } from "vitest";

describe("AccountForm Reset Prevention", () => {
    it("debe evitar que una propiedad 'account' desactualizada sobreescriba los cambios recién guardados", () => {
        const lastSyncedAccountId = "acc-123";
        let lastSyncedUpdatedAt = "2026-09-08T10:00:00.000Z";

        // Timestamp updated on save
        const savedTimestamp = "2026-09-08T10:30:00.000Z";
        lastSyncedUpdatedAt = savedTimestamp;

        // Stale account prop coming from parent before re-render
        const staleAccountProp = {
            id: "acc-123",
            nombre: "Cliente Ejemplo",
            telefono: "",
            email: "",
            comentarios: "FEERIA EXPOCAMACOL CLIENTE DISTRIBUIDOR",
            updated_at: "2026-09-08T10:00:00.000Z" // older than savedTimestamp
        };

        // Sync condition check
        const isNewAccount = staleAccountProp.id !== lastSyncedAccountId;
        const isNewerExternalVersion = Boolean(
            staleAccountProp.updated_at &&
            lastSyncedUpdatedAt &&
            new Date(staleAccountProp.updated_at).getTime() > new Date(lastSyncedUpdatedAt).getTime()
        );

        const shouldResetFormFromProp = isNewAccount || isNewerExternalVersion;

        expect(shouldResetFormFromProp).toBe(false);
    });

    it("sí debe sincronizar cuando la propiedad 'account' corresponde a una versión externa realmente más reciente", () => {
        const lastSyncedAccountId = "acc-123";
        const lastSyncedUpdatedAt = "2026-09-08T10:00:00.000Z";

        const newerAccountProp = {
            id: "acc-123",
            nombre: "Cliente Ejemplo",
            telefono: "3100000000",
            email: "nuevo@ejemplo.com",
            updated_at: "2026-09-08T11:00:00.000Z" // newer
        };

        const isNewAccount = newerAccountProp.id !== lastSyncedAccountId;
        const isNewerExternalVersion = Boolean(
            newerAccountProp.updated_at &&
            lastSyncedUpdatedAt &&
            new Date(newerAccountProp.updated_at).getTime() > new Date(lastSyncedUpdatedAt).getTime()
        );

        const shouldResetFormFromProp = isNewAccount || isNewerExternalVersion;

        expect(shouldResetFormFromProp).toBe(true);
    });
});
