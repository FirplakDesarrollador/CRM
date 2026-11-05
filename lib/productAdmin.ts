import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/lib/stores/useUserStore';
import type { PriceListProduct } from '@/lib/hooks/useProducts';

/**
 * Administración manual de productos y precios (CRM_ListaDePrecios).
 *
 * Solo administradores. La seguridad real está en la base de datos: la política RLS
 * "ListaDePrecios gestionable por admin" solo permite INSERT/UPDATE/DELETE a usuarios
 * con role = 'ADMIN' e is_active = true en CRM_Usuarios. Aquí además se valida en el
 * cliente para dar mensajes claros y no mostrar los botones a quien no es admin.
 */

export const PRICE_FIELDS = [
    { key: 'lista_base_cop', label: 'Base COP (Distribución nacional)' },
    { key: 'distribuidor_pvp_iva', label: 'PVP (Propio) con IVA' },
    { key: 'pvp_sin_iva', label: 'PVP sin IVA' },
    { key: 'lista_base_obras', label: 'Obras nacional' },
    { key: 'lista_base_exportaciones', label: 'Exportación (USD)' },
    { key: 'precio_feria', label: 'Precio feria' },
] as const;

export type PriceFieldKey = typeof PRICE_FIELDS[number]['key'];

export interface ProductFormValues {
    numero_articulo: string;
    descripcion: string;
    planta: string;
    familia: string;
    lista_base_cop: string;
    distribuidor_pvp_iva: string;
    pvp_sin_iva: string;
    lista_base_obras: string;
    lista_base_exportaciones: string;
    precio_feria: string;
}

export interface ProductPayload {
    numero_articulo: string;
    descripcion: string;
    planta: string | null;
    familia: string | null;
    lista_base_cop: number;
    distribuidor_pvp_iva: number;
    pvp_sin_iva: number;
    lista_base_obras: number;
    lista_base_exportaciones: number;
    precio_feria: number;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues | 'precios', string>>;

export const ARTICLE_CODE_REGEX = /^[A-Z0-9][A-Z0-9._\-/]*$/;

export function emptyProductForm(): ProductFormValues {
    return {
        numero_articulo: '',
        descripcion: '',
        planta: '',
        familia: '',
        lista_base_cop: '',
        distribuidor_pvp_iva: '',
        pvp_sin_iva: '',
        lista_base_obras: '',
        lista_base_exportaciones: '',
        precio_feria: '',
    };
}

/**
 * Formatea un número al estilo colombiano sin ambigüedad para parsePriceInput:
 * 12592900 -> "12.592.900", 10582268.91 -> "10.582.268,91", 45.125 -> "45,1250".
 */
export function formatPriceInput(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
    const num = Number(value);
    const negative = num < 0;
    const [intPart, rawDec = ''] = Math.abs(num).toString().includes('e')
        ? Math.abs(num).toFixed(6).replace(/0+$/, '').replace(/\.$/, '').split('.')
        : Math.abs(num).toString().split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    // Con exactamente 3 decimales se agrega un 0 para que no se confunda con miles
    const dec = rawDec.length === 3 ? rawDec + '0' : rawDec;
    return (negative ? '-' : '') + grouped + (dec ? ',' + dec : '');
}

export function productToForm(product: PriceListProduct): ProductFormValues {
    const n = (v: number | null | undefined) => formatPriceInput(v);
    return {
        numero_articulo: product.numero_articulo || '',
        descripcion: product.descripcion || '',
        planta: product.planta || '',
        familia: product.familia || '',
        lista_base_cop: n(product.lista_base_cop),
        distribuidor_pvp_iva: n(product.distribuidor_pvp_iva),
        pvp_sin_iva: n(product.pvp_sin_iva),
        lista_base_obras: n(product.lista_base_obras),
        lista_base_exportaciones: n(product.lista_base_exportaciones),
        precio_feria: n(product.precio_feria),
    };
}

export function normalizeArticleCode(code: string): string {
    return (code || '').trim().toUpperCase();
}

/**
 * Convierte el texto de un campo de precio a número.
 * Acepta "150000", "150.000", "150,000", "150.000,50", "$ 150.000" y "45.5".
 * Vacío => 0 (igual que la carga por Excel). Texto inválido => NaN.
 */
export function parsePriceInput(raw: string): number {
    if (raw === null || raw === undefined) return 0;
    let clean = String(raw).replace(/[$\s]/g, '');
    if (clean === '') return 0;
    if (!/^-?\d[\d.,]*$/.test(clean)) return NaN;

    const hasDot = clean.includes('.');
    const hasComma = clean.includes(',');
    if (hasDot && hasComma) {
        // El último separador es el decimal: 1.500.000,50 o 1,500,000.50
        const decimalSep = clean.lastIndexOf(',') > clean.lastIndexOf('.') ? ',' : '.';
        const thousandSep = decimalSep === ',' ? '.' : ',';
        clean = clean.split(thousandSep).join('').replace(decimalSep, '.');
    } else if (hasDot || hasComma) {
        const sep = hasDot ? '.' : ',';
        const parts = clean.split(sep);
        const leadingZero = /^-?0$/.test(parts[0]);
        const isThousands = parts.length > 2 || (parts[parts.length - 1].length === 3 && !leadingZero);
        clean = isThousands ? parts.join('') : parts.join('.');
    }
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : NaN;
}

export function validateProductForm(
    values: ProductFormValues,
    mode: 'create' | 'edit'
): { errors: ProductFormErrors; payload: ProductPayload | null } {
    const errors: ProductFormErrors = {};
    const code = normalizeArticleCode(values.numero_articulo);
    const descripcion = (values.descripcion || '').trim();

    if (mode === 'create') {
        if (!code) {
            errors.numero_articulo = 'El código de artículo es obligatorio.';
        } else if (code.length > 60) {
            errors.numero_articulo = 'El código no puede tener más de 60 caracteres.';
        } else if (!ARTICLE_CODE_REGEX.test(code)) {
            errors.numero_articulo = 'Usa solo letras, números, guiones, puntos o "/" (sin espacios).';
        }
    }

    if (!descripcion) {
        errors.descripcion = 'La descripción es obligatoria.';
    } else if (descripcion.length > 300) {
        errors.descripcion = 'La descripción no puede tener más de 300 caracteres.';
    }

    const prices = {} as Record<PriceFieldKey, number>;
    for (const field of PRICE_FIELDS) {
        const value = parsePriceInput(values[field.key]);
        if (Number.isNaN(value)) {
            errors[field.key] = 'Debe ser un número válido.';
        } else if (value < 0) {
            errors[field.key] = 'No puede ser negativo.';
        } else if (value > 1_000_000_000_000) {
            errors[field.key] = 'Valor demasiado grande.';
        }
        prices[field.key] = Number.isNaN(value) ? 0 : value;
    }

    const anyPriceError = PRICE_FIELDS.some(f => errors[f.key]);
    if (!anyPriceError && !PRICE_FIELDS.some(f => prices[f.key] > 0)) {
        errors.precios = 'Ingresa al menos un precio mayor a 0.';
    }

    if (Object.keys(errors).length > 0) return { errors, payload: null };

    return {
        errors,
        payload: {
            numero_articulo: code,
            descripcion,
            planta: (values.planta || '').trim() || null,
            familia: (values.familia || '').trim() || null,
            ...prices,
        },
    };
}

export class ProductAdminError extends Error {
    field?: keyof ProductFormValues;
    constructor(message: string, field?: keyof ProductFormValues) {
        super(message);
        this.field = field;
    }
}

function assertAdmin(): string {
    // Rol REAL (no el "ver como" de configuración). La BD vuelve a validar con RLS.
    const user = useUserStore.getState().user;
    if (!user || user.role !== 'ADMIN' || !user.is_active) {
        throw new ProductAdminError('Solo los administradores pueden modificar productos y precios.');
    }
    return user.id;
}

const SELECT_COLUMNS = 'id, numero_articulo, descripcion, lista_base_cop, lista_base_exportaciones, lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva, precio_feria, planta, familia';

function escapeLike(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function articleCodeExists(code: string): Promise<boolean> {
    const normalized = normalizeArticleCode(code);
    if (!normalized) return false;
    const { data, error } = await supabase
        .from('CRM_ListaDePrecios')
        .select('id')
        .ilike('numero_articulo', escapeLike(normalized))
        .limit(1);
    if (error) throw new ProductAdminError('No se pudo validar el código: ' + error.message);
    return (data || []).length > 0;
}

export async function createProduct(payload: ProductPayload): Promise<PriceListProduct> {
    const userId = assertAdmin();
    if (await articleCodeExists(payload.numero_articulo)) {
        throw new ProductAdminError(`Ya existe un producto con el código ${payload.numero_articulo}.`, 'numero_articulo');
    }
    const { data, error } = await supabase
        .from('CRM_ListaDePrecios')
        .insert({ ...payload, created_by: userId, updated_by: userId })
        .select(SELECT_COLUMNS)
        .single();
    if (error) {
        if (error.code === '23505') {
            throw new ProductAdminError(`Ya existe un producto con el código ${payload.numero_articulo}.`, 'numero_articulo');
        }
        if (error.code === '42501') {
            throw new ProductAdminError('No tienes permisos para crear productos (solo administradores).');
        }
        throw new ProductAdminError('No se pudo crear el producto: ' + error.message);
    }
    return data as PriceListProduct;
}

export async function updateProduct(id: string, payload: Omit<ProductPayload, 'numero_articulo'>): Promise<PriceListProduct> {
    const userId = assertAdmin();
    const { data, error } = await supabase
        .from('CRM_ListaDePrecios')
        .update({ ...payload, updated_by: userId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(SELECT_COLUMNS);
    if (error) {
        if (error.code === '42501') {
            throw new ProductAdminError('No tienes permisos para editar productos (solo administradores).');
        }
        throw new ProductAdminError('No se pudo guardar el producto: ' + error.message);
    }
    // Con RLS, un usuario sin permiso no recibe error sino 0 filas actualizadas.
    if (!data || data.length === 0) {
        throw new ProductAdminError('No se guardó ningún cambio. Verifica que tu usuario sea administrador activo.');
    }
    return data[0] as PriceListProduct;
}
