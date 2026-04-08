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
                const keywords = term.split(/\s+/).filter(k => k.length > 0);

                if (prefix) {
                    // Si hay prefijo, traemos los productos de la categoría (con mayor límite) y filtramos localmente
                    query = query.ilike('numero_articulo', `%${prefix}%`).limit(200);
                } else if (keywords.length > 0) {
                    // Búsqueda inteligente: cada palabra debe estar en la descripción O en el número de artículo (AND entre palabras)
                    keywords.forEach(keyword => {
                        const safeKeyword = keyword.replace(/"/g, '');
                        if (safeKeyword.length > 0) {
                            query = query.or(`numero_articulo.ilike.%${safeKeyword}%,descripcion.ilike.%${safeKeyword}%`);
                        }
                    });
                    query = query.limit(50);
                } else {
                    query = query.limit(50);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Supabase query error:', error);
                    throw error;
                }
                
                let finalData = data || [];
                
                // Si hay prefijo y términos adicionales, filtramos localmente asegurando que TODAS las palabras estén presentes
                if (keywords.length > 0 && prefix) {
                    finalData = finalData.filter(p => {
                        return keywords.every(k => {
                            const lowerK = k.toLowerCase();
                            return (p.numero_articulo?.toLowerCase().includes(lowerK)) || 
                                   (p.descripcion?.toLowerCase().includes(lowerK));
                        });
                    });
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
