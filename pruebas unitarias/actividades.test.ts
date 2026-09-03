import { describe, expect, it } from "vitest";
import { filterActivities } from "@/lib/filterUtils";

describe("Filtrado de Actividades", () => {
    const fixedNow = new Date("2026-09-02T12:00:00Z");

    const mockOppMap = new Map([
        ["opp-1", { account_id: "acc-1", nombre: "Proyecto Torre Norte" }],
        ["opp-2", { account_id: "acc-2", nombre: "Remodelación Hotel" }]
    ]);

    const mockAccMap = new Map([
        ["acc-1", { canal_id: "OBRAS_NAC", nombre: "Constructora Bolivar" }],
        ["acc-2", { canal_id: "DIST_NAC", nombre: "Distribuciones del Café" }]
    ]);

    const mockActivities = [
        {
            id: "act-1",
            asunto: "Reunión de especificación de grifería",
            descripcion: "Revisar planos técnicos con arquitecto",
            tipo_actividad: "EVENTO",
            clasificacion_id: 10,
            subclasificacion_id: 101,
            user_id: "user-1",
            opportunity_id: "opp-1",
            account_id: "acc-1",
            is_completed: false,
            fecha_inicio: "2026-08-20T10:00:00Z" // Vencida respecto a fixedNow
        },
        {
            id: "act-2",
            asunto: "Llamada de seguimiento de cotización",
            descripcion: "Confirmar recepción de oferta",
            tipo_actividad: "TAREA",
            clasificacion_id: 20,
            subclasificacion_id: 201,
            user_id: "user-2",
            opportunity_id: "opp-2",
            account_id: "acc-2",
            is_completed: false,
            fecha_inicio: "2026-09-10T15:00:00Z" // Pendiente futura
        },
        {
            id: "act-3",
            asunto: "Visita en obra finalizada",
            descripcion: "Muestras entregadas en portería",
            tipo_actividad: "EVENTO",
            clasificacion_id: 10,
            subclasificacion_id: 102,
            user_id: "user-1",
            opportunity_id: null,
            account_id: "acc-1",
            is_completed: true,
            fecha_inicio: "2026-08-15T08:00:00Z" // Completada
        }
    ];

    it("filtra por estado: completadas, pendientes y vencidas (overdue)", () => {
        const vencidas = filterActivities(mockActivities, { filterStatus: "overdue" }, { now: fixedNow, canViewAll: true });
        expect(vencidas).toHaveLength(1);
        expect(vencidas[0].id).toBe("act-1");

        const pendientes = filterActivities(mockActivities, { filterStatus: "pending" }, { now: fixedNow, canViewAll: true });
        expect(pendientes).toHaveLength(2); // act-1 y act-2

        const hechas = filterActivities(mockActivities, { filterStatus: "completed" }, { now: fixedNow, canViewAll: true });
        expect(hechas).toHaveLength(1);
        expect(hechas[0].id).toBe("act-3");
    });

    it("filtra por tipo, clasificación y subclasificación", () => {
        const tareas = filterActivities(mockActivities, { filterType: "TAREA" }, { canViewAll: true });
        expect(tareas).toHaveLength(1);
        expect(tareas[0].id).toBe("act-2");

        const porClasif = filterActivities(mockActivities, { filterClassification: "10" }, { canViewAll: true });
        expect(porClasif).toHaveLength(2); // act-1 y act-3
    });

    it("filtra por canal resolviendo la relación vía oportunidad o cuenta", () => {
        const obrasNac = filterActivities(mockActivities, { filterChannel: "OBRAS_NAC" }, {
            oppMap: mockOppMap,
            accMap: mockAccMap,
            canViewAll: true
        });
        expect(obrasNac).toHaveLength(2); // act-1 y act-3 pertenecen a acc-1 (OBRAS_NAC)
    });

    it("filtra por búsqueda transversal sobre asunto, descripción y nombres de cuenta/oportunidad", () => {
        const porCuenta = filterActivities(mockActivities, { searchQuery: "Bolivar" }, {
            oppMap: mockOppMap,
            accMap: mockAccMap,
            canViewAll: true
        });
        expect(porCuenta).toHaveLength(2);

        const porAsunto = filterActivities(mockActivities, { searchQuery: "grifería" }, {
            oppMap: mockOppMap,
            accMap: mockAccMap,
            canViewAll: true
        });
        expect(porAsunto).toHaveLength(1);
        expect(porAsunto[0].id).toBe("act-1");
    });

    it("restringe actividades por usuario/colaborador cuando no tiene permiso view_all_activities", () => {
        const resultado = filterActivities(mockActivities, {}, {
            currentUserId: "user-1",
            canViewAll: false,
            collaborativeOppIds: new Set(["opp-2"])
        });
        // user-1 es dueño de act-1 y act-3, y colabora en la oportunidad de act-2
        expect(resultado).toHaveLength(3);
    });

    it("el filtro por canal reduce el conteo total de actividades y excluye canales ajenos", () => {
        const all = filterActivities(mockActivities, {}, {
            oppMap: mockOppMap,
            accMap: mockAccMap,
            canViewAll: true
        });
        expect(all).toHaveLength(3);

        const distNac = filterActivities(mockActivities, { filterChannel: "DIST_NAC" }, {
            oppMap: mockOppMap,
            accMap: mockAccMap,
            canViewAll: true
        });
        expect(distNac).toHaveLength(1);
        expect(distNac[0].id).toBe("act-2");
        expect(distNac.length).toBeLessThan(all.length);
    });

    it("la paginación preserva el total de actividades y limita el lote mostrado a la página", () => {
        const manyActs = Array.from({ length: 150 }, (_, i) => ({
            id: `act-bulk-${i}`,
            asunto: `Actividad ${i}`,
            tipo_actividad: "TAREA",
            user_id: "user-1",
            opportunity_id: "opp-1",
            account_id: "acc-1",
            is_completed: false,
            fecha_inicio: "2026-09-10T10:00:00Z"
        }));

        const filtered = filterActivities(manyActs, { filterChannel: "OBRAS_NAC" }, {
            oppMap: mockOppMap,
            accMap: mockAccMap,
            canViewAll: true
        });
        expect(filtered).toHaveLength(150);

        const pageSize = 100;
        const page1 = filtered.slice(0, pageSize);
        expect(page1).toHaveLength(100);
        expect(filtered.length).toBe(150);

        const page2 = filtered.slice(pageSize, pageSize * 2);
        expect(page2).toHaveLength(50);
    });
});

