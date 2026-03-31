import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PriceListProduct {
    id: string;
    numero_articulo: string;
    descripcion: string;
    lista_base_cop: number | null;
    lista_base_exportaciones: number | null;
    lista_base_obras: number | null; // Nuevo
    distribuidor_pvp_iva: number | null;
    pvp_sin_iva: number | null;
}

export function useProductSearch(searchTerm: string, categoriaPrefijo?: string) {
    const [products, setProducts] = useState<PriceListProduct[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // If there's no prefix AND search term is too short, return empty
        if (!categoriaPrefijo && (!searchTerm || searchTerm.length < 2)) {
            setProducts([]);
            return;
        }

        const searchProducts = async () => {
            setIsLoading(true);
            try {
                // Search by description OR article number
                // We use ilike for partial matches in both
                let query = supabase
                    .from('CRM_ListaDePrecios')
                    .select('id, numero_articulo, descripcion, lista_base_cop, lista_base_exportaciones, lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva')
                    .order('numero_articulo', { ascending: true })
                    .limit(50);

                const term = searchTerm ? searchTerm.trim() : '';
                const prefix = categoriaPrefijo ? categoriaPrefijo.trim() : '';

                if (prefix) {
                    // Si hay prefijo, traemos los productos de la categoría (con mayor límite) y filtramos localmente para evitar
                    // conflictos de múltiples filtros en la misma columna en la API PostgREST.
                    // ATENCIÓN: El prefijo puede no estar al inicio del SKU (ej. BAN02 vs VBAN02), por eso usamos ilike con '%prefix%'
                    query = query.ilike('numero_articulo', `%${prefix}%`).limit(200);
                } else if (term) {
                    // Si no hay prefijo, pero sí término de búsqueda, buscamos normalmente limitando a 50
                    const safeTerm = term.replace(/"/g, ''); 
                    query = query.or(`numero_articulo.ilike.%${safeTerm}%,descripcion.ilike.%${safeTerm}%`).limit(50);
                } else {
                    query = query.limit(50);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Supabase query error:', error);
                    throw error;
                }
                
                let finalData = data || [];
                
                // Si ambos están presentes, filtramos el término a partir de la caché de la categoría
                if (term && prefix) {
                    const lowerTerm = term.toLowerCase();
                    finalData = finalData.filter(p => 
                        (p.numero_articulo && p.numero_articulo.toLowerCase().includes(lowerTerm)) || 
                        (p.descripcion && p.descripcion.toLowerCase().includes(lowerTerm))
                    );
                }

                setProducts(finalData);
            } catch (err) {
                console.error('Error searching products:', err);
                setProducts([]);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce search
        const timeoutId = setTimeout(searchProducts, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, categoriaPrefijo]);

    return { products, isLoading };
}
