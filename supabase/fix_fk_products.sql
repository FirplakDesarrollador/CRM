-- FIX FOREIGN KEY CONSTRAINT FOR COTIZACION ITEMS
-- The UI uses CRM_ListaDePrecios as the product source, but the schema was pointing to an empty CRM_Productos table.

-- 1. Remove the old constraint
ALTER TABLE public."CRM_CotizacionItems" 
DROP CONSTRAINT IF EXISTS fk_crmitem_prod;

-- 2. Add the new constraint pointing to the Price List table
ALTER TABLE public."CRM_CotizacionItems" 
ADD CONSTRAINT fk_crmitem_prod 
FOREIGN KEY (producto_id) 
REFERENCES public."CRM_ListaDePrecios"(id);

-- 3. (Optional but recommended) Sync CRM_Productos for redundancy or future use
-- This ensures that any ID referenced exists in both if ever needed
INSERT INTO public."CRM_Productos" (id, sku, nombre, precio_base, is_active)
SELECT id, numero_articulo, descripcion, COALESCE(lista_base_cop, 0), TRUE
FROM public."CRM_ListaDePrecios"
ON CONFLICT (id) DO UPDATE SET
    sku = EXCLUDED.sku,
    nombre = EXCLUDED.nombre,
    precio_base = EXCLUDED.precio_base;

SELECT 'Constraint fixed and products synced' as Status;
