export interface Product {
    id: string;
    nombre: string;
    codigo: string;
    precio_base: number;
    categoria: string;
}

export const MOCK_PRODUCTS: Product[] = [
    { id: 'p1', nombre: 'Lavamanos Vessel', codigo: 'LAV-001', precio_base: 250000, categoria: 'Baños' },
    { id: 'p2', nombre: 'Mesón Cuarzo Blanco', codigo: 'MES-002', precio_base: 1200000, categoria: 'Cocinas' },
    { id: 'p3', nombre: 'Grifería Monocontrol High', codigo: 'GRI-003', precio_base: 320000, categoria: 'Accesorios' },
    { id: 'p4', nombre: 'Bañera Exenta Oval', codigo: 'BAN-004', precio_base: 4500000, categoria: 'Baños' },
    { id: 'p5', nombre: 'Piso Porcelanato Gris 60x60', codigo: 'PIS-005', precio_base: 85000, categoria: 'Revestimientos' },
];
