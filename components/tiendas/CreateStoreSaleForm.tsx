"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Loader2, Store, DollarSign, CalendarPlus, Search, Trash2 } from "lucide-react";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useActivities } from "@/lib/hooks/useActivities";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useUsers } from "@/lib/hooks/useUsers";

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
    
    // Oportunidad
    fase_id: z.string().min(1, "Fase requerida"),
    amount: z.coerce.number().min(0, "Debe ser mayor a 0"),
    comentarios: z.string().min(1, "Comentario requerido"),
    origen_oportunidad: z.enum(["visita", "wp"], { required_error: "Origen requerido" }),
    categoria_oportunidad: z.string().min(1, "Categoría requerida"),
    canal_id: z.string().min(1, "Canal requerido"),
    asesor_id: z.string().optional(),
    items: z.array(z.object({
        product_id: z.string(),
        cantidad: z.number().min(1),
        precio: z.number(),
        nombre: z.string()
    })).default([]),

    // Actividad
    fecha_inicio: z.string().min(1, "Fecha de inicio requerida"),
    fecha_fin: z.string().min(1, "Fecha de fin requerida"),
    clasificacion_id: z.string().min(1, "Clasificación requerida"),
    prioridad: z.enum(["Baja", "Media", "Alta"]).default("Media"),
    actividad_descripcion: z.string().optional()
});

type StoreSaleFormData = z.infer<typeof storeSaleSchema>;

interface CreateStoreSaleFormProps {
    onSuccess?: () => void;
}

export function CreateStoreSaleForm({ onSuccess }: CreateStoreSaleFormProps) {
    const { createAccount } = useAccounts();
    const { createOpportunity } = useOpportunities();
    const { createActivity } = useActivities();
    const { user } = useCurrentUser();
    const { users } = useUsers();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm);

    // Listas locales (Dexie)
    const countriesList = useLiveQuery(() => db.countries.toArray()) || [];
    const departmentsList = useLiveQuery(() => db.departments.toArray()) || [];
    const citiesList = useLiveQuery(() => db.cities.toArray()) || [];
    const classifications = useLiveQuery(() => db.activityClassifications.toArray().then(arr => arr.filter(c => !c.is_deleted)), []) || [];

    // Fases locales (se inicializan después del form)

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
            amount: 0,
            fase_id: "",
            comentarios: "",
            origen_oportunidad: "visita",
            categoria_oportunidad: "",
            canal_id: "PROPIO",
            fecha_inicio: "",
            fecha_fin: "",
            clasificacion_id: "",
            prioridad: "Media",
            actividad_descripcion: "",
            items: []
        }
    });

    // Fases locales para autoseleccionar la inicial
    const selectedChannel = watch("canal_id");
    const phasesList = useLiveQuery(() => db.phases.where('canal_id').equals(selectedChannel || 'PROPIO').sortBy('orden'), [selectedChannel]) || [];

    // Cargar datos por defecto
    useEffect(() => {
        reset();
        setValue("pais_id", "1");
            setValue("origen_oportunidad", "visita");
            if (phasesList && phasesList.length > 0) {
                setValue("fase_id", String(phasesList[0].id));
            }

            // Fechas por defecto para la actividad (Ahora y en 1 hora)
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const startISO = now.toISOString().slice(0, 16);
            
            const later = new Date(now.getTime() + 60 * 60 * 1000);
            const endISO = later.toISOString().slice(0, 16);

            setValue("fecha_inicio", startISO);
            setValue("fecha_fin", endISO);
    }, [reset, setValue]);

    const items: any[] = watch("items") || [];

    const addProduct = (product: PriceListProduct) => {
        // En tiendas el canal es PROPIO, el precio es distribuidor_pvp_iva
        let price = Number(product.distribuidor_pvp_iva) || 0;
        if (price === 0) price = Number(product.lista_base_cop) || Number(product.pvp_sin_iva) || 0;

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
        const total = (items || []).reduce((acc: number, curr: any) => 
            acc + ((Number(curr.precio) || 0) * (Number(curr.cantidad) || 0)), 0
        );
        setValue("amount", total);
    }, [items, setValue]);

    const onSubmit = async (data: StoreSaleFormData) => {
        setIsSubmitting(true);
        try {
            // VALIDACIÓN DE DUPLICADOS LOCALES
            const duplicates = await db.accounts.filter(a => 
                a.nit_base === data.nit_base || (!!a.telefono && a.telefono === data.telefono)
            ).toArray();

            let accountId = "";

            // Determinar Asesor / Owner Final
            let finalOwnerId = user?.id;
            if (data.asesor_id) {
                finalOwnerId = data.asesor_id;
            } else {
                if (data.canal_id === 'PROPIO') {
                    const assignedUser = users?.find(u => u.email === 'daniela.castro@firplak.com');
                    if (assignedUser) finalOwnerId = assignedUser.id;
                } else if (data.canal_id === 'OBRAS_NAC') {
                    const assignedUser = users?.find(u => u.email === 'mayerly.marin@firplak.com');
                    if (assignedUser) finalOwnerId = assignedUser.id;
                } else if (['OBRAS_INT', 'DIST_INT', 'DIST_NAC'].includes(data.canal_id)) {
                    const assignedUser = users?.find(u => u.email === 'juan.correa@firplak.com');
                    if (assignedUser) finalOwnerId = assignedUser.id;
                }
            }

            if (duplicates.length > 0) {
                // Usar el cliente existente
                accountId = duplicates[0].id;
                console.log("Cliente ya existe, usando ID existente:", accountId);
            } else {
                // 1. Crear Cuenta si no existe
                const accountData = {
                    nombre: data.nombre_cuenta,
                    nit_base: data.nit_base,
                    canal_id: data.canal_id, 
                    telefono: data.telefono,
                    email: data.email || null,
                    direccion: data.direccion || null,
                    pais_id: data.pais_id ? Number(data.pais_id) : null,
                    departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
                    ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null,
                    // Conservamos compatibilidad string con DB
                    ciudad: data.ciudad_id ? citiesList.find(c => String(c.id) === data.ciudad_id)?.nombre : null,
                    es_premium: false,
                    owner_user_id: finalOwnerId
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
                owner_user_id: finalOwnerId,
            };
            const opportunityId = await createOpportunity(opportunityData);

            if (!opportunityId) {
                console.warn("No se obtuvo ID de oportunidad. La actividad podría no quedar bien vinculada.");
            }

            // 3. Crear Actividad
            const activityData = {
                opportunity_id: opportunityId,
                account_id: accountId,
                classification_id: Number(data.clasificacion_id),
                tipo_actividad: "REUNION",
                descripcion: data.actividad_descripcion || "Seguimiento de venta en tienda",
                fecha_inicio: data.fecha_inicio,
                fecha_fin: data.fecha_fin,
                prioridad: data.prioridad,
                user_id: finalOwnerId,
            };
            await createActivity(activityData);

            if (onSuccess) onSuccess();
            reset();
            setSearchTerm("");
        } catch (error) {
            console.error("Error creando venta de tienda:", error);
            alert("Ocurrió un error al intentar crear el registro.");
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
                                            {...register("amount")} 
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
                                        <option value="visita">Visita</option>
                                        <option value="wp">WhatsApp (WP)</option>
                                    </select>
                                    {errors.origen_oportunidad && <p className="text-red-500 text-xs mt-1">{errors.origen_oportunidad.message}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Categoría *</label>
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
                                    {errors.categoria_oportunidad && <p className="text-red-500 text-xs mt-1">{errors.categoria_oportunidad.message}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Canal *</label>
                                    <select 
                                        {...register("canal_id")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="DIST_NAC">Distribución Nacional</option>
                                        <option value="OBRAS_NAC">Obras Nacional</option>
                                        <option value="DIST_INT">Distribución Internacional</option>
                                        <option value="OBRAS_INT">Obras Internacional</option>
                                        <option value="PROPIO">Canal Propio</option>
                                    </select>
                                    {errors.canal_id && <p className="text-red-500 text-xs mt-1">{errors.canal_id.message}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700">Asesor Encargado (Opcional)</label>
                                    <select 
                                        {...register("asesor_id")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="">(Asignación Automática)</option>
                                        {users?.filter(u => u.is_active).map(u => (
                                            <option key={u.id} value={u.id}>{u.nombre || u.email}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

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
                                                    let displayPrice = Number(product.distribuidor_pvp_iva) || 0;
                                                    if (displayPrice === 0) displayPrice = Number(product.lista_base_cop) || Number(product.pvp_sin_iva) || 0;

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
                                        items.map((item: any) => (
                                            <div key={item.product_id} className="flex items-center gap-4 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm text-slate-800">{item.nombre}</div>
                                                    <div className="text-xs text-slate-500">COP $ {new Intl.NumberFormat().format(item.precio || 0)} c/u</div>
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
                                        {classifications.map(c => (
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
                        onClick={() => { reset(); setSearchTerm(""); }} 
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
