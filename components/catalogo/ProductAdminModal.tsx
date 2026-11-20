"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, PackagePlus, Pencil, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PriceListProduct } from "@/lib/hooks/useProducts";
import {
    PRICE_FIELDS,
    ProductAdminError,
    ProductFormErrors,
    ProductFormValues,
    createProduct,
    emptyProductForm,
    parsePriceInput,
    productToForm,
    updateProduct,
    validateProductForm,
} from "@/lib/productAdmin";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export interface ProductAdminModalProps {
    open: boolean;
    mode: "create" | "edit";
    product?: PriceListProduct | null;
    plants: string[];
    families: string[];
    onClose: () => void;
    onSaved: (product: PriceListProduct, mode: "create" | "edit") => void;
}

/**
 * Modal SOLO para administradores: crear un producto nuevo o editar precios/datos
 * de un producto existente en CRM_ListaDePrecios sin pasar por la carga de Excel.
 */
export function ProductAdminModal({ open, mode, product, plants, families, onClose, onSaved }: ProductAdminModalProps) {
    const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
    const [errors, setErrors] = useState<ProductFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setValues(mode === "edit" && product ? productToForm(product) : emptyProductForm());
        setErrors({});
        setSubmitError(null);
        setIsSaving(false);
    }, [open, mode, product]);

    const original = useMemo(() => (mode === "edit" && product ? productToForm(product) : null), [mode, product]);

    const setField = (key: keyof ProductFormValues, value: string) => {
        setValues(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: undefined, precios: undefined }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitError(null);
        const { errors: validationErrors, payload } = validateProductForm(values, mode);
        setErrors(validationErrors);
        if (!payload) return;

        setIsSaving(true);
        try {
            let saved: PriceListProduct;
            if (mode === "create") {
                saved = await createProduct(payload);
            } else {
                if (!product) throw new ProductAdminError("No hay producto seleccionado.");
                saved = await updateProduct(product.id, {
                    descripcion: payload.descripcion,
                    planta: payload.planta,
                    familia: payload.familia,
                    lista_base_cop: payload.lista_base_cop,
                    distribuidor_pvp_iva: payload.distribuidor_pvp_iva,
                    pvp_sin_iva: payload.pvp_sin_iva,
                    lista_base_obras: payload.lista_base_obras,
                    lista_base_exportaciones: payload.lista_base_exportaciones,
                    precio_feria: payload.precio_feria,
                });
            }
            onSaved(saved, mode);
        } catch (err) {
            if (err instanceof ProductAdminError && err.field) {
                setErrors(prev => ({ ...prev, [err.field as string]: err.message }));
            } else {
                setSubmitError(err instanceof Error ? err.message : "Error desconocido al guardar.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = (hasError?: string) =>
        `w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-2 text-sm text-slate-800 placeholder-slate-400 ${
            hasError ? "border-red-400 focus:ring-red-300 bg-red-50/40" : "border-slate-300 focus:ring-cyan-500"
        }`;

    return (
        <Dialog open={open} onOpenChange={next => { if (!next && !isSaving) onClose(); }}>
            <DialogContent className="max-w-2xl rounded-2xl max-h-[92vh] overflow-y-auto" data-testid="product-admin-modal">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                        <span className="p-2 rounded-xl bg-cyan-100 text-cyan-700">
                            {mode === "create" ? <PackagePlus className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
                        </span>
                        {mode === "create" ? "Nuevo producto" : "Editar producto y precios"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Solo administradores. Los cambios aplican de inmediato en el catálogo, cotizaciones y pedidos nuevos.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="space-y-1 text-xs font-bold text-slate-500 sm:col-span-1">
                            <span>CÓDIGO DE ARTÍCULO *</span>
                            <input
                                name="numero_articulo"
                                value={values.numero_articulo}
                                onChange={e => setField("numero_articulo", e.target.value.toUpperCase())}
                                disabled={mode === "edit"}
                                placeholder="VHEM05-0009-000-0100"
                                className={`${inputClass(errors.numero_articulo)} font-mono ${mode === "edit" ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}`}
                                autoFocus={mode === "create"}
                            />
                            {errors.numero_articulo && <span className="block text-[11px] font-semibold text-red-600">{errors.numero_articulo}</span>}
                        </label>
                        <label className="space-y-1 text-xs font-bold text-slate-500 sm:col-span-2">
                            <span>DESCRIPCIÓN *</span>
                            <input
                                name="descripcion"
                                value={values.descripcion}
                                onChange={e => setField("descripcion", e.target.value)}
                                placeholder="Nombre o descripción del producto"
                                className={inputClass(errors.descripcion)}
                            />
                            {errors.descripcion && <span className="block text-[11px] font-semibold text-red-600">{errors.descripcion}</span>}
                        </label>
                        <label className="space-y-1 text-xs font-bold text-slate-500">
                            <span>PLANTA</span>
                            <input
                                name="planta"
                                list="product-admin-plants"
                                value={values.planta}
                                onChange={e => setField("planta", e.target.value)}
                                placeholder="FVHMP, MBL, PC..."
                                className={inputClass(errors.planta)}
                            />
                            <datalist id="product-admin-plants">
                                {plants.map(item => <option key={item} value={item} />)}
                            </datalist>
                        </label>
                        <label className="space-y-1 text-xs font-bold text-slate-500 sm:col-span-2">
                            <span>FAMILIA</span>
                            <input
                                name="familia"
                                list="product-admin-families"
                                value={values.familia}
                                onChange={e => setField("familia", e.target.value)}
                                placeholder="Selecciona o escribe la familia"
                                className={inputClass(errors.familia)}
                            />
                            <datalist id="product-admin-families">
                                {families.map(item => <option key={item} value={item} />)}
                            </datalist>
                        </label>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Listas de precios</p>
                            <p className="text-[11px] text-slate-400">Vacío = 0. Al menos un precio debe ser mayor a 0.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {PRICE_FIELDS.map(field => {
                                const parsed = parsePriceInput(values[field.key]);
                                const before = original ? parsePriceInput(original[field.key]) : null;
                                const changed = before !== null && !Number.isNaN(parsed) && parsed !== before;
                                return (
                                    <label key={field.key} className="space-y-1 text-[11px] font-bold text-slate-500">
                                        <span className="flex items-center gap-1">
                                            {field.label}
                                            {changed && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px]">MODIFICADO</span>}
                                        </span>
                                        <input
                                            name={field.key}
                                            inputMode="decimal"
                                            value={values[field.key]}
                                            onChange={e => setField(field.key, e.target.value)}
                                            placeholder="0"
                                            className={`${inputClass(errors[field.key])} text-right font-semibold`}
                                        />
                                        {errors[field.key] ? (
                                            <span className="block text-[11px] font-semibold text-red-600">{errors[field.key]}</span>
                                        ) : (
                                            <span className="block text-[10px] font-medium text-slate-400 text-right">
                                                {field.key === "lista_base_exportaciones"
                                                    ? (Number.isNaN(parsed) ? "-" : `USD ${parsed.toLocaleString("es-CO")}`)
                                                    : (Number.isNaN(parsed) ? "-" : money.format(parsed))}
                                                {changed && before !== null && field.key !== "lista_base_exportaciones" && ` (antes ${money.format(before)})`}
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                        {errors.precios && (
                            <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.precios}</p>
                        )}
                    </div>

                    {submitError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {submitError}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm shadow-cyan-200 disabled:opacity-60"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === "create" ? "Crear producto" : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
