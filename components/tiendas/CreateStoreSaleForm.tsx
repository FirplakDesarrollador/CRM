"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Store, DollarSign, CalendarPlus, Search, Trash2, TicketCheck } from "lucide-react";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useActivities } from "@/lib/hooks/useActivities";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalActivity } from "@/lib/db";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useUsers } from "@/lib/hooks/useUsers";
import { useOpportunityOrigins } from "@/lib/hooks/useOpportunityOrigins";
import { reserveFairInventory, useInventorySummary } from "@/lib/hooks/useInventory";
import { getProductPrice, SALES_CHANNELS } from "@/lib/salesChannels";

// Eschema de validación combinado
const storeSaleSchema = z.object({
    // Cuenta
    nombre_cuenta: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(5, "Cédula requerida"),
    telefono: z.string().min(7, "Teléfono requerido"),
    pais_id: z.string().min(1, "País requerido"),
    departamento_id: z.string().optional().nullable(),
    ciudad_id: z.string().optional().nullable(),
    direccion: z.string().optional().nullable(),
    email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
    canal_id: z.string().min(1, "Canal de venta requerido"),
    subclasificacion_id: z.string().min(1, "Subclasificación requerida"),
    
    // Oportunidad
    fase_id: z.string().min(1, "Fase requerida"),
    amount: z.number().min(0, "Debe ser mayor a 0"),
    comentarios: z.string().min(1, "Comentario requerido"),
    origen_oportunidad: z.string().min(1, "Origen requerido"),
    venta_feria: z.boolean(),
    categoria_oportunidad: z.string().optional(),
    asesor_id: z.string().optional(),
    items: z.array(z.object({
        product_id: z.string(),
        cantidad: z.number().min(1),
        precio: z.number(),
        nombre: z.string(),
        numero_articulo: z.string(),
        lista_base_cop: z.number().nullable(),
        lista_base_exportaciones: z.number().nullable(),
        lista_base_obras: z.number().nullable(),
        distribuidor_pvp_iva: z.number().nullable(),
        pvp_sin_iva: z.number().nullable(),
        precio_feria: z.number().nullable(),
        inventario_disponible: z.number().optional(),
    })),

    // Actividad
    fecha_inicio: z.string().min(1, "Fecha de inicio requerida"),
    fecha_fin: z.string().min(1, "Fecha de fin requerida"),
    clasificacion_id: z.string().min(1, "Clasificación requerida"),
    prioridad: z.enum(["Baja", "Media", "Alta"]),
    actividad_descripcion: z.string().optional()
});

type StoreSaleFormData = z.infer<typeof storeSaleSchema>;
type StoreSaleItem = StoreSaleFormData["items"][number];

interface CreateStoreSaleFormProps {
    onSuccess?: () => void;
}

export function CreateStoreSaleForm({ onSuccess }: CreateStoreSaleFormProps) {
    const { createAccount, updateAccount } = useAccounts();
    const { createOpportunity } = useOpportunities();
    const { createActivity } = useActivities();
    const { user } = useCurrentUser();
    const { users } = useUsers();
    const { origins, isLoading: isLoadingOrigins } = useOpportunityOrigins();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm);
    const searchProductIds = useMemo(() => searchResults.map(product => product.id), [searchResults]);
    const { summary: inventorySummary } = useInventorySummary(searchProductIds);
    const inventoryByProduct = useMemo(
        () => new Map(inventorySummary.map(item => [item.producto_id, item])),
        [inventorySummary],
    );

    // Listas locales (Dexie)
    const countriesList = useLiveQuery(() => db.countries.toArray()) || [];
    const departmentsList = useLiveQuery(() => db.departments.toArray()) || [];
    const citiesList = useLiveQuery(() => db.cities.toArray()) || [];
    const subclassificationsQuery = useLiveQuery(() => db.subclasificaciones.toArray());
    const subclassifications = useMemo(() => subclassificationsQuery || [], [subclassificationsQuery]);
    const classifications = useLiveQuery(() => db.activityClassifications.toArray().then(arr => arr.filter(c => !c.is_deleted)), []) || [];
    const eventClassifications = classifications.filter(c => c.tipo_actividad === "EVENTO");

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors }
    } = useForm<StoreSaleFormData>({
        resolver: zodResolver(storeSaleSchema),
        defaultValues: {
            nombre_cuenta: "",
            nit_base: "",
            telefono: "",
            pais_id: "1", // Por defecto Colombia
            departamento_id: "",
            ciudad_id: "",
            direccion: "",
            email: "",
            canal_id: "PROPIO",
            subclasificacion_id: "",
            amount: 0,
            fase_id: "",
            comentarios: "",
            origen_oportunidad: "visita",
            venta_feria: false,
            fecha_inicio: "",
            fecha_fin: "",
            clasificacion_id: "",
            prioridad: "Media",
            actividad_descripcion: "",
            items: []
        }
    });

    const selectedChannel = watch("canal_id") || "PROPIO";
    const isFairSale = watch("venta_feria") || false;
    const phasesQuery = useLiveQuery(
        () => db.phases.where("canal_id").equals(selectedChannel).sortBy("orden"),
        [selectedChannel],
    );
    const phasesList = useMemo(() => phasesQuery || [], [phasesQuery]);
    const channelSubclassifications = useMemo(
        () => subclassifications.filter(item => item.canal_id === selectedChannel),
        [subclassifications, selectedChannel],
    );

    const resetStoreForm = useCallback(() => {
        reset();
        setValue("pais_id", "1");
        setValue("origen_oportunidad", "visita");

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const later = new Date(now.getTime() + 60 * 60 * 1000);
        setValue("fecha_inicio", now.toISOString().slice(0, 16));
        setValue("fecha_fin", later.toISOString().slice(0, 16));
    }, [reset, setValue]);

    // Cargar fechas por defecto al abrir el formulario.
    useEffect(() => {
        resetStoreForm();
    }, [resetStoreForm]);

    const watchedItems = watch("items");
    const items = useMemo(() => watchedItems || [], [watchedItems]);

    // Cada canal inicia con su primera fase y subclasificacion disponibles.
    useEffect(() => {
        const currentPhase = watch("fase_id");
        if (phasesList.length > 0 && !phasesList.some(phase => String(phase.id) === currentPhase)) {
            setValue("fase_id", String(phasesList[0].id));
        }
    }, [phasesList, setValue, watch]);

    useEffect(() => {
        const currentSubclass = watch("subclasificacion_id");
        if (channelSubclassifications.length > 0 && !channelSubclassifications.some(item => String(item.id) === currentSubclass)) {
            setValue("subclasificacion_id", String(channelSubclassifications[0].id));
        }
    }, [channelSubclassifications, setValue, watch]);

    useEffect(() => {
        const currentOrigin = watch("origen_oportunidad");
        if (origins.length > 0 && !origins.some(origin => origin.codigo === currentOrigin)) {
            setValue("origen_oportunidad", origins[0].codigo);
        }
    }, [origins, setValue, watch]);

    // Recalcular los productos ya elegidos al cambiar canal o venta de feria.
    useEffect(() => {
        const repriced = items.map(item => ({ ...item, precio: getProductPrice(item, selectedChannel, isFairSale) }));
        if (repriced.some((item, index) => item.precio !== items[index].precio)) {
            setValue("items", repriced);
        }
    }, [selectedChannel, isFairSale, items, setValue]);

    const addProduct = (product: PriceListProduct) => {
        const price = getProductPrice(product, selectedChannel, isFairSale);
        const available = inventoryByProduct.get(product.id)?.disponible || 0;
        if ((isFairSale || selectedChannel === "FERIA") && price <= 0) {
            alert("Este producto no tiene precio de feria configurado.");
            return;
        }
        if (isFairSale && available < 1) {
            alert("Este producto no tiene inventario disponible para reservar.");
            return;
        }

        const existing = items.find(item => item.product_id === product.id);
        if (existing) {
            if (isFairSale && existing.cantidad + 1 > available) {
                alert(`Solo hay ${available} unidades disponibles para feria.`);
                return;
            }
            const newItems = items.map(item => item.product_id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
            setValue("items", newItems);
        } else {
            setValue("items", [...items, {
                product_id: product.id,
                nombre: product.descripcion,
                numero_articulo: product.numero_articulo,
                cantidad: 1,
                precio: price,
                lista_base_cop: product.lista_base_cop,
                lista_base_exportaciones: product.lista_base_exportaciones,
                lista_base_obras: product.lista_base_obras,
                distribuidor_pvp_iva: product.distribuidor_pvp_iva,
                pvp_sin_iva: product.pvp_sin_iva,
                precio_feria: product.precio_feria,
                inventario_disponible: available,
            }]);
        }
        setSearchTerm("");
    };

    const updateQuantity = (productId: string, qty: number) => {
        const item = items.find(current => current.product_id === productId);
        let validQty = isNaN(qty) ? 1 : Math.max(1, qty);
        if (isFairSale && item?.inventario_disponible !== undefined) {
            validQty = Math.min(validQty, item.inventario_disponible);
        }
        setValue("items", items.map(current => current.product_id === productId ? { ...current, cantidad: validQty } : current));
    };

    const removeProduct = (productId: string) => {
        setValue("items", items.filter(item => item.product_id !== productId));
    };

    // Calculate total from items
    useEffect(() => {
        const total = items.reduce((acc, curr) =>
            acc + ((Number(curr.precio) || 0) * (Number(curr.cantidad) || 0)), 0
        );
        setValue("amount", total);
    }, [items, setValue]);

    const onSubmit = async (data: StoreSaleFormData) => {
        setIsSubmitting(true);
        try {
            if (data.venta_feria) {
                const unavailableItem = data.items.find(item => item.cantidad > (item.inventario_disponible || 0));
                if (unavailableItem) {
                    throw new Error(`Inventario insuficiente para ${unavailableItem.nombre}. Disponible: ${unavailableItem.inventario_disponible || 0}.`);
                }
                const withoutFairPrice = data.items.find(item => item.precio_feria === null || Number(item.precio_feria) <= 0);
                if (withoutFairPrice) {
                    throw new Error(`${withoutFairPrice.nombre} no tiene precio de feria configurado.`);
                }
            }

            // VALIDACIÓN DE DUPLICADOS LOCALES
            const duplicates = await db.accounts.filter(a => 
                a.nit_base === data.nit_base || (!!a.telefono && a.telefono === data.telefono)
            ).toArray();

            let accountId = "";

            if (duplicates.length > 0) {
                // Usar el cliente existente
                accountId = duplicates[0].id;
                await updateAccount(accountId, {
                    ...duplicates[0],
                    canal_id: data.canal_id,
                    subclasificacion_id: Number(data.subclasificacion_id),
                });
                console.log("Cliente ya existe, usando ID existente:", accountId);
            } else {
                // 1. Crear Cuenta si no existe
                const accountData = {
                    nombre: data.nombre_cuenta,
                    nit_base: data.nit_base,
                    canal_id: data.canal_id,
                    subclasificacion_id: Number(data.subclasificacion_id),
                    telefono: data.telefono,
                    email: data.email || undefined,
                    direccion: data.direccion || undefined,
                    pais_id: data.pais_id ? Number(data.pais_id) : null,
                    departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
                    ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null,
                    // Conservamos compatibilidad string con DB
                    ciudad: data.ciudad_id ? citiesList.find(c => String(c.id) === data.ciudad_id)?.nombre : undefined,
                    es_premium: false
                };

                const newId = await createAccount(accountData);
                if (newId) {
                    accountId = newId;
                }
            }

            if (!accountId) {
                throw new Error("No se pudo obtener el ID de la cuenta.");
            }

            // 2. Crear Oportunidad
            const combinedComentarios = data.categoria_oportunidad ? 
                `Categoría: ${data.categoria_oportunidad}\n\n${data.comentarios}` : data.comentarios;

            const opportunityData = {
                account_id: accountId,
                nombre: `Venta - ${data.nombre_cuenta}`,
                amount: data.amount,
                fase_id: Number(data.fase_id),
                estado_id: 1, // OPEN
                currency_id: "COP",
                origen_oportunidad: data.origen_oportunidad,
                comentarios: combinedComentarios,
                items: data.items,
                owner_user_id: data.asesor_id || user?.id,
            };
            const opportunityId = await createOpportunity(opportunityData);

            if (!opportunityId) {
                throw new Error("No se pudo obtener el ID de la oportunidad.");
            }

            if (data.venta_feria && data.items.length > 0) {
                await reserveFairInventory(data.items, opportunityId);
            }

            // 3. Crear Actividad
            const activityData = {
                opportunity_id: opportunityId,
                account_id: accountId,
                clasificacion_id: Number(data.clasificacion_id),
                tipo_actividad: "EVENTO",
                descripcion: data.actividad_descripcion || "Seguimiento de venta en tienda",
                fecha_inicio: data.fecha_inicio,
                fecha_fin: data.fecha_fin,
                prioridad: data.prioridad,
                user_id: data.asesor_id || user?.id,
            } satisfies Partial<LocalActivity>;
            await createActivity(activityData);

            if (onSuccess) onSuccess();
            resetStoreForm();
            setSearchTerm("");
        } catch (error) {
            console.error("Error creando venta de tienda:", error);
            alert(error instanceof Error ? error.message : "Ocurrió un error al intentar crear el registro.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full flex flex-col">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 w-full flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-800">Registrar Venta / Cliente</h2>
                    <p className="text-sm text-slate-500">Crea un cliente y su oportunidad al mismo tiempo.</p>
                </div>

                <div className="p-6 flex-1">
                    <form id="store-sale-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        
                        {/* SECCIÓN CUENTA */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-800 border-b pb-2">
                                <Store className="w-5 h-5" /> Datos del Cliente
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Nombre *</label>
                                    <input {...register("nombre_cuenta")} className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nombre completo" />
                                    {errors.nombre_cuenta && <p className="text-red-500 text-xs mt-1">{errors.nombre_cuenta.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Cédula / NIT *</label>
                                    <input {...register("nit_base")} className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="123456789" />
                                    {errors.nit_base && <p className="text-red-500 text-xs mt-1">{errors.nit_base.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Teléfono *</label>
                                    <input {...register("telefono")} className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="300 000 0000" />
                                    {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Email (Opcional)</label>
                                    <input {...register("email")} type="email" className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="correo@ejemplo.com" />
                                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Canal de Venta *</label>
                                    <select {...register("canal_id")} className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                                        {SALES_CHANNELS.map(channel => <option key={channel.id} value={channel.id}>{channel.nombre}</option>)}
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1">El canal o tipo de cuenta define la lista de precios aplicada.</p>
                                    {errors.canal_id && <p className="text-red-500 text-xs mt-1">{errors.canal_id.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Subclasificación *</label>
                                    <select {...register("subclasificacion_id")} disabled={!selectedChannel || channelSubclassifications.length === 0} className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 disabled:bg-slate-100 focus:ring-2 focus:ring-blue-500 outline-none">
                                        {channelSubclassifications.length === 0 && <option value="">Sin opciones sincronizadas</option>}
                                        {channelSubclassifications.map(item => <option key={item.id} value={String(item.id)}>{item.nombre}</option>)}
                                    </select>
                                    {errors.subclasificacion_id && <p className="text-red-500 text-xs mt-1">{errors.subclasificacion_id.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">País</label>
                                    <select
                                        {...register("pais_id")}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                        onChange={(e) => {
                                            register("pais_id").onChange(e);
                                            setValue("departamento_id", "");
                                            setValue("ciudad_id", "");
                                        }}
                                    >
                                        <option value="">Seleccione...</option>
                                        {countriesList.map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Departamento</label>
                                    <select
                                        {...register("departamento_id")}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                                        disabled={!watch("pais_id")}
                                        onChange={(e) => {
                                            register("departamento_id").onChange(e);
                                            setValue("ciudad_id", "");
                                        }}
                                    >
                                        <option value="">Seleccione...</option>
                                        {departmentsList
                                            .filter(dep => String(dep.pais_id) === watch("pais_id"))
                                            .map(dep => (
                                                <option key={dep.id} value={String(dep.id)}>{dep.nombre}</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Ciudad</label>
                                    <select
                                        {...register("ciudad_id")}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50"
                                        disabled={!watch("departamento_id")}
                                    >
                                        <option value="">Seleccione...</option>
                                        {citiesList
                                            .filter(c => String(c.departamento_id) === watch("departamento_id"))
                                            .map(city => (
                                                <option key={city.id} value={String(city.id)}>{city.nombre}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-sm font-medium text-slate-700">Dirección (Opcional)</label>
                                <input {...register("direccion")} className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Calle/Carrera" />
                            </div>
                        </section>

                        {/* SECCIÓN OPORTUNIDAD */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-700 border-b pb-2">
                                <DollarSign className="w-5 h-5" /> Datos del Negocio (Oportunidad)
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Fase de Oportunidad *</label>
                                    <select 
                                        {...register("fase_id")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="">Seleccione fase...</option>
                                        {phasesList.map(fase => (
                                            <option key={fase.id} value={String(fase.id)}>{fase.nombre}</option>
                                        ))}
                                    </select>
                                    {errors.fase_id && <p className="text-red-500 text-xs mt-1">{errors.fase_id.message}</p>}
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Valor Estimado *</label>
                                    <div className="relative mt-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-500 sm:text-sm">$</span>
                                        </div>
                                        <input 
                                            {...register("amount", { valueAsNumber: true })}
                                            type="number" 
                                            readOnly={items.length > 0}
                                            className={`w-full pl-7 pr-12 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-green-500 outline-none ${items.length > 0 ? "bg-slate-100" : ""}`} 
                                            placeholder="0.00" 
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-slate-500 sm:text-sm">COP</span>
                                        </div>
                                    </div>
                                    {items.length > 0 && <p className="text-[10px] text-blue-600 mt-1">Calculado automáticamente por productos</p>}
                                    {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Origen de Oportunidad *</label>
                                    <select 
                                        {...register("origen_oportunidad")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        {isLoadingOrigins && <option value="">Cargando...</option>}
                                        {!isLoadingOrigins && origins.length === 0 && (
                                            <>
                                                <option value="visita">Visita</option>
                                                <option value="wp">WhatsApp</option>
                                            </>
                                        )}
                                        {origins.map(origin => <option key={origin.id} value={origin.codigo}>{origin.nombre}</option>)}
                                    </select>
                                    {errors.origen_oportunidad && <p className="text-red-500 text-xs mt-1">{errors.origen_oportunidad.message}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Categoría (Opcional)</label>
                                    <select 
                                        {...register("categoria_oportunidad")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="">Seleccione...</option>
                                        <option value="Baños">Baños</option>
                                        <option value="Zona de Labores">Zona de Labores</option>
                                        <option value="Cocinas">Cocinas</option>
                                        <option value="Hidromasajes">Hidromasajes</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Asesor Encargado (Opcional)</label>
                                    <select 
                                        {...register("asesor_id")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="">(Asignarme a mí)</option>
                                        {users?.filter(u => u.is_active).map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 cursor-pointer">
                                <input type="checkbox" {...register("venta_feria")} className="mt-1 w-5 h-5 rounded border-amber-400 text-amber-600" />
                                <TicketCheck className="w-5 h-5 text-amber-700 mt-0.5" />
                                <span>
                                    <span className="block font-bold text-amber-900">Venta de feria</span>
                                    <span className="block text-xs text-amber-700">Usa el precio de feria y reserva el inventario seleccionado al crear la oportunidad.</span>
                                </span>
                            </label>

                            {/* BUSCADOR DE PRODUCTOS */}
                            <div className="pt-2">
                                <label className="text-sm font-medium text-slate-700">Productos de la Oportunidad</label>
                                <div className="relative mt-1 mb-3">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 sm:text-sm"
                                        placeholder="Buscar más productos para agregar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {isSearching ? (
                                                <div className="p-4 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
                                                </div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="p-4 text-center text-slate-500 text-sm">No se encontraron productos</div>
                                            ) : (
                                                searchResults.map((product: PriceListProduct) => {
                                                    const displayPrice = getProductPrice(product, selectedChannel, isFairSale);
                                                    const inventory = inventoryByProduct.get(product.id);
                                                    const unavailable = isFairSale && (!inventory || inventory.disponible < 1);

                                                    return (
                                                        <button
                                                            key={product.id}
                                                            type="button"
                                                            onClick={() => addProduct(product)}
                                                            disabled={unavailable}
                                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between border-b last:border-0"
                                                        >
                                                            <div>
                                                                <div className="font-medium text-slate-900">{product.descripcion}</div>
                                                                <div className="text-xs text-slate-500">{product.numero_articulo} · Disponible: {inventory?.disponible || 0}</div>
                                                            </div>
                                                            <div className="text-sm font-bold text-blue-600">
                                                                COP $ {new Intl.NumberFormat().format(displayPrice)}
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* LISTA DE PRODUCTOS SELECCIONADOS */}
                                <div className="space-y-2">
                                    {items.length === 0 ? (
                                        <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                                            <div className="text-slate-400 text-sm">No has agregado productos todavía.</div>
                                        </div>
                                    ) : (
                                        items.map((item: StoreSaleItem) => (
                                            <div key={item.product_id} className="flex items-center gap-4 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm text-slate-800">{item.nombre}</div>
                                                    <div className="text-xs text-slate-500">COP $ {new Intl.NumberFormat().format(item.precio || 0)} c/u{isFairSale ? ` · ${item.inventario_disponible || 0} disponibles` : ""}</div>
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

                            <div>
                                <label className="text-sm font-medium text-slate-700">Comentarios *</label>
                                <textarea 
                                    {...register("comentarios")} 
                                    rows={3}
                                    className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-green-500 outline-none resize-none" 
                                    placeholder="Detalles sobre el negocio o productos interesados..." 
                                />
                                {errors.comentarios && <p className="text-red-500 text-xs mt-1">{errors.comentarios.message}</p>}
                            </div>
                        </section>

                        {/* SECCIÓN ACTIVIDAD */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-600 border-b pb-2">
                                <CalendarPlus className="w-5 h-5" /> Actividad Programada
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Clasificación *</label>
                                    <select 
                                        {...register("clasificacion_id")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="">Seleccione...</option>
                                        {eventClassifications.map(c => (
                                            <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                                        ))}
                                    </select>
                                    {errors.clasificacion_id && <p className="text-red-500 text-xs mt-1">{errors.clasificacion_id.message}</p>}
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Prioridad *</label>
                                    <select 
                                        {...register("prioridad")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                    {errors.prioridad && <p className="text-red-500 text-xs mt-1">{errors.prioridad.message}</p>}
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Fecha y Hora Inicial *</label>
                                    <input 
                                        {...register("fecha_inicio")} 
                                        type="datetime-local" 
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" 
                                    />
                                    {errors.fecha_inicio && <p className="text-red-500 text-xs mt-1">{errors.fecha_inicio.message}</p>}
                                </div>
                                
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Fecha y Hora Final *</label>
                                    <input 
                                        {...register("fecha_fin")} 
                                        type="datetime-local" 
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" 
                                    />
                                    {errors.fecha_fin && <p className="text-red-500 text-xs mt-1">{errors.fecha_fin.message}</p>}
                                </div>
                                
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Comentarios de la Actividad (Opcional)</label>
                                    <textarea 
                                        {...register("actividad_descripcion")} 
                                        rows={3}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none resize-none" 
                                        placeholder="Detalles sobre lo que se realizará en la actividad..." 
                                    />
                                </div>
                            </div>
                        </section>

                    </form>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={() => { resetStoreForm(); setSearchTerm(""); }}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Limpiar Formulario
                    </button>
                    <button 
                        type="submit" 
                        form="store-sale-form"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isSubmitting ? "Guardando..." : "Crear Registro"}
                    </button>
                </div>
            </div>
        </div>
    );
}
