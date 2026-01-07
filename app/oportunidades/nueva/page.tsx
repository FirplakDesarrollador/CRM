"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check } from "lucide-react";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { Trash2, PlusCircle, Search, Loader2 } from "lucide-react";

const STEP_LABELS = ["Cuenta", "Datos del Negocio", "Productos", "Equipo"];

const schema = z.object({
    account_id: z.string().min(1, "Debe seleccionar una cuenta"),
    nombre: z.string().min(3, "Nombre requerido"),
    amount: z.coerce.number().min(0),
    currency_id: z.enum(["COP", "USD"]),
    fase: z.string(),
    items: z.array(z.object({
        product_id: z.string(),
        cantidad: z.number().min(1),
        precio: z.number(),
        nombre: z.string()
    })).default([])
});

export default function CreateOpportunityWizard() {
    const router = useRouter();
    const { createOpportunity } = useOpportunities();
    const { accounts } = useAccounts();

    const [step, setStep] = useState(0);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            currency_id: 'COP',
            fase: 'Prospect',
            amount: 0,
            items: []
        }
    });

    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm);

    const items = watch("items") || [];
    const amount = watch("amount") || 0;

    const addProduct = (product: PriceListProduct) => {
        const existing = items.find((i: any) => i.product_id === product.id);
        if (existing) {
            const newItems = items.map((i: any) => i.product_id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i);
            setValue("items", newItems);
        } else {
            setValue("items", [...items, {
                product_id: product.id,
                nombre: product.descripcion,
                cantidad: 1,
                precio: product.lista_base_cop || product.pvp_sin_iva || 0
            }]);
        }
        setSearchTerm("");
    };

    const updateQuantity = (productId: string, qty: number) => {
        setValue("items", items.map((i: any) => i.product_id === productId ? { ...i, cantidad: Math.max(1, qty) } : i));
    };

    const removeProduct = (productId: string) => {
        setValue("items", items.filter((i: any) => i.product_id !== productId));
    };

    // Calculate total from items
    useEffect(() => {
        if (items.length > 0) {
            const total = items.reduce((acc: number, curr: any) => acc + (curr.precio * curr.cantidad), 0);
            setValue("amount", total);
        }
    }, [items, setValue]);

    const onSubmit = async (data: any) => {
        try {
            await createOpportunity(data);
            router.push("/oportunidades");
        } catch (err) {
            console.error(err);
        }
    };

    const nextStep = (e: any) => {
        e.preventDefault();
        setStep(s => Math.min(s + 1, 3));
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Nueva Oportunidad</h1>

            {/* Steps Indicator */}
            <div className="flex items-center space-x-4 mb-8 overflow-x-auto pb-2">
                {STEP_LABELS.map((label, idx) => (
                    <div key={idx} className="flex items-center shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                            {idx + 1}
                        </div>
                        <span className={`ml-2 text-sm ${idx === step ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{label}</span>
                        {idx < 3 && <div className="ml-4 w-8 h-0.5 bg-slate-200" />}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

                {/* STEP 1: ACCOUNT */}
                {step === 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Seleccionar Cuenta</h2>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cliente</label>
                            <select
                                {...register("account_id")}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Buscar cuenta...</option>
                                {accounts?.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.nombre} ({acc.nit || 'Sin NIT'})</option>
                                ))}
                            </select>
                            {errors.account_id && <p className="text-red-500 text-xs">{(errors.account_id as any).message}</p>}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowAccountModal(true)}
                            className="text-blue-600 text-sm font-medium hover:underline"
                        >
                            + Crear nueva cuenta rápida
                        </button>
                    </div>
                )}

                {/* STEP 2: INFO */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Datos del Negocio</h2>

                        <div>
                            <label className="text-sm font-medium">Nombre Oportunidad</label>
                            <input {...register("nombre")} className="w-full p-2 border rounded-lg" placeholder="Ej. Proyecto Edificio Norte" />
                            {errors.nombre && <p className="text-red-500 text-xs">{(errors.nombre as any).message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Moneda</label>
                                <select {...register("currency_id")} className="w-full p-2 border rounded-lg">
                                    <option value="COP">COP (Pesos)</option>
                                    <option value="USD">USD (Dólares)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Valor Estimado</label>
                                <input type="number" {...register("amount")} className="w-full p-2 border rounded-lg" />
                                {items.length > 0 && <p className="text-[10px] text-blue-600 mt-1">Calculado automáticamente por productos</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: PRODUCTS */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Productos del Negocio</h2>
                            <span className="text-sm font-bold text-blue-600">Total: {watch("currency_id")} {new Intl.NumberFormat().format(amount as number)}</span>
                        </div>

                        {/* Product Search */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                placeholder="Buscar productos por nombre o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {isSearching ? (
                                        <div className="p-4 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Buscando...
                                        </div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-sm">No se encontraron productos</div>
                                    ) : (
                                        searchResults.map((product: PriceListProduct) => (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => addProduct(product)}
                                                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between border-b last:border-0"
                                            >
                                                <div>
                                                    <div className="font-medium text-slate-900">{product.descripcion}</div>
                                                    <div className="text-xs text-slate-500">{product.numero_articulo}</div>
                                                </div>
                                                <div className="text-sm font-bold text-blue-600">
                                                    ${new Intl.NumberFormat().format(product.lista_base_cop || 0)}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Items */}
                        <div className="space-y-3">
                            {items.length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <div className="text-slate-400 text-sm mb-2">No has agregado productos todavía.</div>
                                    <div className="text-xs text-slate-400">Usa la búsqueda para agregar productos desde la primera fase.</div>
                                </div>
                            ) : (
                                items.map((item, idx) => (
                                    <div key={item.product_id} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-slate-800">{item.nombre}</div>
                                            <div className="text-xs text-slate-500">${new Intl.NumberFormat().format(item.precio)} c/u</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                className="w-16 p-1 border rounded text-center text-sm"
                                                value={item.cantidad}
                                                onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeProduct(item.product_id)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 4: TEAM */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Asignación</h2>
                        <p className="text-sm text-slate-500">Tú serás el propietario (Owner) por defecto.</p>
                        {/* Here we would add Collaborator multiselect */}
                        <div className="p-4 bg-slate-50 rounded text-sm text-slate-500 italic">
                            Selección de colaboradores próximamente...
                        </div>
                    </div>
                )}

                {/* ACTIONS */}
                <div className="flex justify-between mt-8 pt-4 border-t">
                    {step > 0 ? (
                        <button type="button" onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-slate-600">Atrás</button>
                    ) : <div />}

                    {step < 3 ? (
                        <button type="button" onClick={nextStep} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center">
                            Siguiente <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                    ) : (
                        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg flex items-center font-bold">
                            Crear Oportunidad <Check className="w-4 h-4 ml-2" />
                        </button>
                    )}
                </div>

            </form>

            {/* Fast Account Modal */}
            {showAccountModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg p-6">
                        <h3 className="text-lg font-bold mb-4">Nueva Cuenta Rápida</h3>
                        <AccountForm
                            onSuccess={() => {
                                // Ideally capture ID of created account and set it
                                setShowAccountModal(false);
                            }}
                            onCancel={() => setShowAccountModal(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
