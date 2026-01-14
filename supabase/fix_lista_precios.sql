-- CRM_ListaDePrecios: Product Price List from BD precios CRM.xlsx
-- Run this in Supabase SQL Editor to update column type

ALTER TABLE "CRM_ListaDePrecios" 
    ALTER COLUMN distribuidor_descuento TYPE numeric(10, 4);
