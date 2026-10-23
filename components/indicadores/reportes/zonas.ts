// Agrupación comercial de los departamentos de Colombia en "zonas" de venta,
// para el filtro de Zona en Indicadores (aparece cuando hay un Canal
// seleccionado, igual que en el BI de referencia: "Costa Atlántico",
// "Antioquia", etc.). No existe hoy una tabla de zonas comerciales en la
// base de datos, solo País/Departamento/Ciudad — esto es una aproximación
// con las regiones estándar de Colombia (Antioquia se deja como su propia
// zona, en vez de mezclarla con el resto de la región Andina).
//
// Si esta agrupación no coincide exactamente con cómo el negocio divide sus
// zonas comerciales, ZONA_BY_DEPARTAMENTO_ID es la única fuente de verdad —
// ajusta las asignaciones ahí, nada más en la app depende de la lista exacta.

export const ZONA_ORDER = [
    "Antioquia",
    "Costa Atlántico",
    "Eje Cafetero",
    "Centro",
    "Pacífico",
    "Orinoquía y Amazonía",
] as const;

export type ZonaId = typeof ZONA_ORDER[number];

// departamento_id (CRM_Departamentos, DANE) -> zona
export const ZONA_BY_DEPARTAMENTO_ID: Record<number, ZonaId> = {
    5: "Antioquia", // Antioquia
    8: "Costa Atlántico", // Atlántico
    11: "Centro", // Bogotá D.C.
    13: "Costa Atlántico", // Bolívar
    15: "Centro", // Boyacá
    17: "Eje Cafetero", // Caldas
    18: "Orinoquía y Amazonía", // Caquetá
    19: "Pacífico", // Cauca
    20: "Costa Atlántico", // Cesar
    23: "Costa Atlántico", // Córdoba
    25: "Centro", // Cundinamarca
    27: "Pacífico", // Chocó
    41: "Centro", // Huila
    44: "Costa Atlántico", // La Guajira
    47: "Costa Atlántico", // Magdalena
    50: "Orinoquía y Amazonía", // Meta
    52: "Pacífico", // Nariño
    54: "Centro", // Norte de Santander
    63: "Eje Cafetero", // Quindío
    66: "Eje Cafetero", // Risaralda
    68: "Centro", // Santander
    70: "Costa Atlántico", // Sucre
    73: "Centro", // Tolima
    76: "Pacífico", // Valle del Cauca
    81: "Orinoquía y Amazonía", // Arauca
    85: "Orinoquía y Amazonía", // Casanare
    86: "Orinoquía y Amazonía", // Putumayo
    88: "Costa Atlántico", // Archipiélago de San Andrés, Providencia y Santa Catalina
    91: "Orinoquía y Amazonía", // Amazonas
    94: "Orinoquía y Amazonía", // Guainía
    95: "Orinoquía y Amazonía", // Guaviare
    97: "Orinoquía y Amazonía", // Vaupés
    99: "Orinoquía y Amazonía", // Vichada
};

export function getZonaByDepartamentoId(departamentoId: number | null | undefined): ZonaId | null {
    if (departamentoId == null) return null;
    return ZONA_BY_DEPARTAMENTO_ID[departamentoId] || null;
}

export const ZONA_OPTIONS = ZONA_ORDER.map(z => ({ value: z, label: z }));
