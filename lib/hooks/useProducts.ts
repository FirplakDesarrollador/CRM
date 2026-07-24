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
    precio_feria: number | null;
    planta?: string | null;
    familia?: string | null;
}

export function useProductSearch(
    searchTerm: string, 
    categoriaPrefijo?: string, 
    loadInitial = false,
    plantFilter?: string,
    familyFilter?: string
) {
    const [products, setProducts] = useState<PriceListProduct[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // If there's no prefix, no filters, AND search term is too short, return empty
        if (!loadInitial && !categoriaPrefijo && !plantFilter && !familyFilter && (!searchTerm || searchTerm.length < 2)) {
            setProducts([]);
            return;
        }

        const searchProducts = async () => {
            setIsLoading(true);
            try {
                let query = supabase
                    .from('CRM_ListaDePrecios')
                    .select('id, numero_articulo, descripcion, lista_base_cop, lista_base_exportaciones, lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva, precio_feria, planta, familia')
                    .order('numero_articulo', { ascending: true });

                if (plantFilter) {
                    query = query.eq('planta', plantFilter);
                }
                if (familyFilter) {
                    query = query.eq('familia', familyFilter);
                }

                const term = searchTerm ? searchTerm.trim() : '';
                const prefix = categoriaPrefijo ? categoriaPrefijo.trim() : '';
                const keywords = term.split(/\s+/).filter(k => k.length > 0);

                if (prefix) {
                    query = query.ilike('numero_articulo', `%${prefix}%`).limit(500);
                } else if (keywords.length > 0) {
                    keywords.forEach(keyword => {
                        const safeKeyword = keyword.replace(/"/g, '');
                        if (safeKeyword.length > 0) {
                            query = query.or(`numero_articulo.ilike.%${safeKeyword}%,descripcion.ilike.%${safeKeyword}%`);
                        }
                    });
                    query = query.limit(300);
                } else {
                    query = query.limit(300);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Supabase query error:', error);
                    throw error;
                }
                
                let finalData = data || [];
                
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

        const timeoutId = setTimeout(searchProducts, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, categoriaPrefijo, loadInitial, plantFilter, familyFilter]);

    return { products, isLoading };
}

export function useProductFilterOptions() {
    const [plants, setPlants] = useState<string[]>([]);
    const [families, setFamilies] = useState<string[]>([]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const { data: pData } = await supabase
                    .from('CRM_ListaDePrecios')
                    .select('planta')
                    .not('planta', 'is', null);

                const { data: fData } = await supabase
                    .from('CRM_ListaDePrecios')
                    .select('familia')
                    .not('familia', 'is', null);

                if (pData) {
                    const uniquePlants = Array.from(new Set(pData.map(p => p.planta).filter(Boolean))).sort() as string[];
                    setPlants(uniquePlants);
                }
                if (fData) {
                    const uniqueFamilies = Array.from(new Set(fData.map(f => f.familia).filter(Boolean))).sort() as string[];
                    setFamilies(uniqueFamilies);
                }
            } catch (err) {
                console.error('Error fetching filter options:', err);
            }
        };
        fetchFilters();
    }, []);

    return { plants, families };
}
