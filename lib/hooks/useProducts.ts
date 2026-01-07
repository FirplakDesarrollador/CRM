import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface PriceListProduct {
    id: string;
    numero_articulo: string;
    descripcion: string;
    lista_base_cop: number | null;
    distribuidor_pvp_iva: number | null;
    pvp_sin_iva: number | null;
}

export function useProductSearch(searchTerm: string) {
    const [products, setProducts] = useState<PriceListProduct[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!searchTerm || searchTerm.length < 2) {
            setProducts([]);
            return;
        }

        const searchProducts = async () => {
            setIsLoading(true);
            try {
                // Search by description OR article number
                // We use ilike for partial matches in both
                const { data, error } = await supabase
                    .from('CRM_ListaDePrecios')
                    .select('id, numero_articulo, descripcion, lista_base_cop, distribuidor_pvp_iva, pvp_sin_iva')
                    .or(`numero_articulo.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%`)
                    .order('numero_articulo', { ascending: true })
                    .limit(20);

                if (error) throw error;
                setProducts(data || []);
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
    }, [searchTerm]);

    return { products, isLoading };
}
