import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { includesNormalized, matchesSearchTokens } from '@/lib/utils';

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

let catalogCache: PriceListProduct[] | null = null;
let filterOptionsCache: { plants: string[]; families: string[] } | null = null;
let fetchCatalogPromise: Promise<PriceListProduct[]> | null = null;

export async function fetchFullCatalog(forceRefresh = false): Promise<PriceListProduct[]> {
    if (!forceRefresh && catalogCache) {
        return catalogCache;
    }
    if (fetchCatalogPromise && !forceRefresh) {
        return fetchCatalogPromise;
    }

    fetchCatalogPromise = (async () => {
        try {
            const { data, error } = await supabase
                .from('CRM_ListaDePrecios')
                .select('id, numero_articulo, descripcion, lista_base_cop, lista_base_exportaciones, lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva, precio_feria, planta, familia')
                .order('numero_articulo', { ascending: true })
                .limit(10000);

            if (error) throw error;
            catalogCache = data || [];

            // Extraer y cachear plantas y familias
            const uniquePlants = Array.from(new Set(catalogCache.map(p => p.planta).filter(Boolean))).sort() as string[];
            const uniqueFamilies = Array.from(new Set(catalogCache.map(p => p.familia).filter(Boolean))).sort() as string[];
            filterOptionsCache = { plants: uniquePlants, families: uniqueFamilies };

            return catalogCache;
        } finally {
            fetchCatalogPromise = null;
        }
    })();

    return fetchCatalogPromise;
}

export function useFullCatalog() {
    const [products, setProducts] = useState<PriceListProduct[]>(catalogCache || []);
    const [isLoading, setIsLoading] = useState(!catalogCache);

    useEffect(() => {
        let isMounted = true;
        if (!catalogCache) {
            setIsLoading(true);
            fetchFullCatalog()
                .then(data => {
                    if (isMounted) {
                        setProducts(data);
                        setIsLoading(false);
                    }
                })
                .catch(err => {
                    console.error('Error fetching full catalog:', err);
                    if (isMounted) setIsLoading(false);
                });
        }
        return () => { isMounted = false; };
    }, []);

    const refresh = async () => {
        setIsLoading(true);
        try {
            const data = await fetchFullCatalog(true);
            setProducts(data);
        } finally {
            setIsLoading(false);
        }
    };

    return { products, isLoading, refresh };
}

export interface ProductSearchOptions {
    limit?: number;
    onlyFeria?: boolean;
    productIds?: string[];
}

export function useProductSearch(
    searchTerm: string, 
    categoriaPrefijo?: string, 
    loadInitial = false,
    plantFilter?: string,
    familyFilter?: string,
    options?: ProductSearchOptions
) {
    const [products, setProducts] = useState<PriceListProduct[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // If productIds is provided but empty, no products can match
        if (options?.productIds !== undefined && options.productIds.length === 0) {
            setProducts([]);
            setIsLoading(false);
            return;
        }

        // If there's no prefix, no filters, AND search term is too short, return empty
        if (!loadInitial && !categoriaPrefijo && !plantFilter && !familyFilter && !options?.onlyFeria && !options?.productIds && (!searchTerm || searchTerm.length < 2)) {
            setProducts([]);
            return;
        }

        const searchProducts = async () => {
            setIsLoading(true);
            try {
                // Si el catálogo ya está en caché, filtrar en memoria instantáneamente
                if (catalogCache && catalogCache.length > 0) {
                    let results = catalogCache;

                    if (plantFilter) {
                        results = results.filter(p => p.planta === plantFilter);
                    }
                    if (familyFilter) {
                        results = results.filter(p => p.familia === familyFilter);
                    }
                    if (options?.onlyFeria) {
                        results = results.filter(p => (p.precio_feria || 0) > 0);
                    }
                    if (options?.productIds && options.productIds.length > 0) {
                        const idSet = new Set(options.productIds);
                        results = results.filter(p => idSet.has(p.id));
                    }
                    if (categoriaPrefijo) {
                        const prefix = categoriaPrefijo.toLowerCase().trim();
                        results = results.filter(p => p.numero_articulo?.toLowerCase().includes(prefix));
                    }
                    if (searchTerm && searchTerm.trim().length > 0) {
                        results = results.filter(p => {
                            const combined = `${p.numero_articulo || ''} ${p.descripcion || ''}`;
                            return matchesSearchTokens(combined, searchTerm);
                        });
                    }

                    if (options?.limit !== undefined) {
                        results = results.slice(0, options.limit);
                    }
                    setProducts(results);
                    setIsLoading(false);
                    return;
                }

                // Si no está en caché, consultar Supabase
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
                if (options?.onlyFeria) {
                    query = query.gt('precio_feria', 0);
                }
                if (options?.productIds && options.productIds.length > 0) {
                    query = query.in('id', options.productIds);
                }

                const term = searchTerm ? searchTerm.trim() : '';
                const prefix = categoriaPrefijo ? categoriaPrefijo.trim() : '';
                const keywords = term.split(/\s+/).filter(k => k.length > 0);

                if (prefix) {
                    query = query.ilike('numero_articulo', `%${prefix}%`);
                } else if (keywords.length > 0) {
                    keywords.forEach(keyword => {
                        const safeKeyword = keyword.replace(/"/g, '');
                        if (safeKeyword.length > 0) {
                            const wildcardPattern = safeKeyword.replace(/[aáeéiíoóuúnñ]/gi, '_');
                            query = query.or(`numero_articulo.ilike.%${safeKeyword}%,descripcion.ilike.%${safeKeyword}%,descripcion.ilike.%${wildcardPattern}%`);
                        }
                    });
                }

                const maxLimit = options?.limit !== undefined 
                    ? options.limit 
                    : (loadInitial || plantFilter || familyFilter || options?.onlyFeria || options?.productIds ? 10000 : 300);
                
                query = query.limit(maxLimit);

                const { data, error } = await query;

                if (error) {
                    console.error('Supabase query error:', error);
                    throw error;
                }
                
                let finalData = data || [];
                
                if (keywords.length > 0) {
                    finalData = finalData.filter(p => {
                        return keywords.every(k => {
                            return includesNormalized(p.numero_articulo, k) || 
                                   includesNormalized(p.descripcion, k);
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

        const timeoutId = setTimeout(searchProducts, catalogCache ? 50 : 250);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, categoriaPrefijo, loadInitial, plantFilter, familyFilter, options?.onlyFeria, options?.productIds?.join(','), options?.limit]);

    return { products, isLoading };
}

export function useProductFilterOptions() {
    const [plants, setPlants] = useState<string[]>(filterOptionsCache?.plants || ['FVHMP', 'MBL', 'PC']);
    const [families, setFamilies] = useState<string[]>(filterOptionsCache?.families || []);

    useEffect(() => {
        if (filterOptionsCache) {
            setPlants(filterOptionsCache.plants);
            setFamilies(filterOptionsCache.families);
            return;
        }

        fetchFullCatalog()
            .then(() => {
                if (filterOptionsCache) {
                    setPlants(filterOptionsCache.plants);
                    setFamilies(filterOptionsCache.families);
                }
            })
            .catch(err => console.error('Error fetching filter options:', err));
    }, []);

    return { plants, families };
}
