"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Check } from "lucide-react";
import { AccountForm } from "@/components/cuentas/AccountForm";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { Trash2, PlusCircle, Search, Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { cn } from "@/components/ui/utils";

const STEP_LABELS = ["Cuenta", "Datos del Negocio", "Productos", "Equipo"];

const schema = z.object({
    account_id: z.string().min(1, "Debe seleccionar una cuenta"),
    nombre: z.string().min(3, "Nombre requerido (mín. 3 caracteres)"),
    amount: z.coerce.number().min(0),
    currency_id: z.enum(["COP", "USD"]),
    estado_id: z.coerce.number().default(1), // 1 = Abierta
    fase_id: z.coerce.number().min(1, "Fase requerida").default(1),
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
    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        trigger
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            account_id: '',
            nombre: '',
            currency_id: 'COP' as 'COP' | 'USD',
            estado_id: 1,
            fase_id: 1,
            amount: 0,
            items: []
        }
    });

    const searchParams = useSearchParams();

    // Auto-select account from URL param and jump to step 1
    useEffect(() => {
        const accountId = searchParams.get('account_id');
        if (accountId && accounts.length > 0) {
            const acc = accounts.find(a => a.id === accountId);
            if (acc) {
                setValue("account_id", acc.id);
                setSelectedAccount(acc);
                setAccountSearchTerm(acc.nombre);
                setStep(1); // Advance to "Datos del Negocio"
            }
        }
    }, [searchParams, accounts, setValue]);

    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm);

    // Filtrar cuentas para el buscador
    const filteredAccounts = (accounts || []).filter(acc =>
        acc.nombre.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
        (acc.nit || '').includes(accountSearchTerm)
    );

    const handleSelectAccount = (acc: any) => {
        setValue("account_id", acc.id);
        setSelectedAccount(acc);
        setAccountSearchTerm(acc.nombre);
        setShowAccountDropdown(false);
    };

    // Obtener fases según canal de la cuenta
    const selectedAccountId = watch("account_id");

    const filteredPhases = useLiveQuery(async () => {
        if (!selectedAccountId) return [];
        const acc = await db.accounts.get(selectedAccountId);
        if (!acc) return [];
        const channelId = acc.canal_id || 'DIST_NAC';
        return await db.phases.where('canal_id').equals(channelId).sortBy('orden');
    }, [selectedAccountId]);

    // Auto-seleccionar primera fase y MONEDA según canal
    useEffect(() => {
        if (filteredPhases && filteredPhases.length > 0) {
            const currentFase = Number(watch("fase_id"));
            const isValid = filteredPhases.some(f => f.id === currentFase);
            if (!isValid) {
                setValue("fase_id", filteredPhases[0].id);
            }
        }

        // Force Currency based on Channel
        if (selectedAccount) {
            const channel = selectedAccount.canal_id;
            if (channel === 'OBRAS_INT' || channel === 'DIST_INT') {
                setValue("currency_id", "USD");
            } else {
                // Optional: Reset to COP or keep user selection for others?
                // Start with COP for non-international if needed, or let them choose.
                const current = watch("currency_id");
                if (current === 'USD' && (channel === 'DIST_NAC' || channel === 'OBRAS_NAC' || channel === 'PROPIO')) {
                    // If they manually switched back to a NAC account from an INT one, maybe default back to COP
                    setValue("currency_id", "COP");
                }
            }
        }
    }, [filteredPhases, setValue, watch, selectedAccount]);

    const items: any[] = watch("items") || [];
    const amount = watch("amount") || 0;
    const currencyId = watch("currency_id");

    const addProduct = (product: PriceListProduct) => {
        const channel = selectedAccount?.canal_id || 'DIST_NAC';
        let price = 0;

        // Strict Price Selection
        switch (channel) {
            case 'OBRAS_NAC':
                price = product.lista_base_obras || 0;
                break;
            case 'OBRAS_INT':
            case 'DIST_INT':
                price = product.lista_base_exportaciones || 0;
                break;
            case 'PROPIO':
                price = product.distribuidor_pvp_iva || 0;
                break;
            case 'DIST_NAC':
            default:
                price = product.lista_base_cop || 0;
        }

        // Fallback if 0
        if (price === 0) price = product.lista_base_cop || 0;

        const existing = items.find((i: any) => i.product_id === product.id);
        if (existing) {
            const newItems = items.map((i: any) => i.product_id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i);
            setValue("items", newItems);
        } else {
            setValue("items", [...items, {
                product_id: product.id,
                nombre: product.descripcion,
                cantidad: 1,
                precio: price
            }]);
        }
        setSearchTerm("");
    };

    const updateQuantity = (productId: string, qty: number) => {
        const validQty = isNaN(qty) ? 1 : Math.max(1, qty);
        setValue("items", items.map((i: any) => i.product_id === productId ? { ...i, cantidad: validQty } : i));
    };

    const removeProduct = (productId: string) => {
        setValue("items", items.filter((i: any) => i.product_id !== productId));
    };

    // Calculate total from items
    useEffect(() => {
        if (items.length > 0) {
            const total = items.reduce((acc: number, curr: any) => acc + ((curr.precio || 0) * (curr.cantidad || 1)), 0);
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

    const nextStep = async (e: any) => {
        e.preventDefault();

        // Validate current step fields before proceeding
        let isValid = false;
        if (step === 0) {
            isValid = await trigger('account_id');
        } else if (step === 1) {
            isValid = await trigger(['nombre', 'currency_id', 'amount', 'fase_id']);
        } else {
            // Steps 2 and 3 have no required fields
            isValid = true;
        }

        if (isValid) {
            setStep(s => Math.min(s + 1, 3));
        }
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

                        <div className="space-y-2 relative">
                            <label className="text-sm font-medium text-slate-700">Cliente / Cuenta</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                    placeholder="Buscar por nombre o NIT..."
                                    value={accountSearchTerm}
                                    onChange={(e) => {
                                        setAccountSearchTerm(e.target.value);
                                        setShowAccountDropdown(true);
                                        if (selectedAccount && e.target.value !== selectedAccount.nombre) {
                                            setSelectedAccount(null);
                                            setValue("account_id", "");
                                        }
                                    }}
                                    onFocus={() => setShowAccountDropdown(true)}
                                />
                                {selectedAccount && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <Check className="h-4 w-4 text-green-500" />
                                    </div>
                                )}
                            </div>

                            {showAccountDropdown && accountSearchTerm.length > 0 && !selectedAccount && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto border-t-0 rounded-t-none">
                                    {filteredAccounts.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-sm">No se encontraron cuentas</div>
                                    ) : (
                                        filteredAccounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                type="button"
                                                onClick={() => handleSelectAccount(acc)}
                                                className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                                            >
                                                <div>
                                                    <div className="font-medium text-slate-900 text-sm">{acc.nombre}</div>
                                                    <div className="text-xs text-slate-500">{acc.nit || 'Sin NIT'}</div>
                                                </div>
                                                <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                    {acc.canal_id}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Back-click overlay to close dropdown */}
                            {showAccountDropdown && !selectedAccount && (
                                <div
                                    className="fixed inset-0 z-40 bg-transparent"
                                    onClick={() => setShowAccountDropdown(false)}
                                />
                            )}

                            {errors.account_id && <p className="text-red-500 text-xs">{errors.account_id.message as string}</p>}
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
                                <label className="text-sm font-medium text-slate-500">Moneda</label>
                                <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700">
                                    {watch("currency_id")}
                                </div>
                            </div>

                            {/* Phase Selector (Dynamic) */}
                            <div>
                                <label className="text-sm font-medium">Fase Inicial</label>
                                <select {...register("fase_id")} className="w-full p-2 border rounded-lg">
                                    {filteredPhases?.map(phase => (
                                        <option key={phase.id} value={phase.id}>
                                            {phase.nombre}
                                        </option>
                                    ))}
                                    {(!filteredPhases || filteredPhases.length === 0) && <option value="1">Cargando fases...</option>}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Valor Estimado</label>
                            <input type="number" {...register("amount")} className="w-full p-2 border rounded-lg" />
                            {items.length > 0 && <p className="text-[10px] text-blue-600 mt-1">Calculado automáticamente por productos</p>}
                        </div>
                    </div>
                )}

                {/* STEP 3: PRODUCTS */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Productos del Negocio</h2>
                            <span className="text-sm font-bold text-blue-600">Total: {watch("currency_id")} {new Intl.NumberFormat().format((amount as number) || 0)}</span>
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
                                        searchResults.map((product: PriceListProduct) => {
                                            const channel = selectedAccount?.canal_id || 'DIST_NAC';
                                            let displayPrice = 0;
                                            switch (channel) {
                                                case 'OBRAS_NAC': displayPrice = product.lista_base_obras || 0; break;
                                                case 'OBRAS_INT':
                                                case 'DIST_INT': displayPrice = product.lista_base_exportaciones || 0; break;
                                                case 'PROPIO': displayPrice = product.distribuidor_pvp_iva || 0; break;
                                                default: displayPrice = product.lista_base_cop || 0;
                                            }
                                            if (displayPrice === 0) displayPrice = product.lista_base_cop || 0;

                                            return (
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
                                                        {currencyId} {new Intl.NumberFormat().format(displayPrice)}
                                                    </div>
                                                </button>
                                            );
                                        })
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
                                items.map((item: any, idx: number) => (
                                    <div key={item.product_id} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-slate-800">{item.nombre}</div>
                                            <div className="text-xs text-slate-500">{currencyId} {new Intl.NumberFormat().format(item.precio || 0)} c/u</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                className="w-16 p-1 border rounded text-center text-sm"
                                                value={isNaN(item.cantidad) ? "" : item.cantidad}
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

                {/* NAVIGATION */}
                <div className="flex justify-between pt-6 border-t mt-6">
                    <button
                        type="button"
                        onClick={() => setStep(s => Math.max(0, s - 1))}
                        disabled={step === 0}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${step === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        Atrás
                    </button>

                    {step < 3 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                            Siguiente Paso <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-green-200"
                        >
                            Crear Oportunidad <Check className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </form>

            {/* Modal de Crear Cuenta (Simplificado) */}
            {showAccountModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center sticky top-0">
                            <h3 className="font-semibold text-blue-900">Crear Nueva Cuenta</h3>
                        </div>
                        <div className="p-6">
                            <AccountForm
                                onSuccess={() => setShowAccountModal(false)}
                                onCancel={() => setShowAccountModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
