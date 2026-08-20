"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Store, DollarSign, CalendarPlus, Search, Trash2, TicketCheck, ChevronDown, ChevronUp, Lock, UserPlus } from "lucide-react";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useOpportunities } from "@/lib/hooks/useOpportunities";
import { useActivities } from "@/lib/hooks/useActivities";
import { useContacts } from "@/lib/hooks/useContacts";
import { useProductSearch, PriceListProduct } from "@/lib/hooks/useProducts";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalActivity, type LocalPais, type LocalDepartamento, type LocalCiudad, type LocalCuenta } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useUsers } from "@/lib/hooks/useUsers";
import { useOpportunityOrigins } from "@/lib/hooks/useOpportunityOrigins";
import { reserveFairInventory, useInventorySummary } from "@/lib/hooks/useInventory";
import { getProductPrice, SALES_CHANNELS } from "@/lib/salesChannels";
import { cn, includesNormalized, matchesSearchTokens, removeAccents } from "@/lib/utils";

// Eschema de validación combinado
const storeSaleSchema = z.object({
    // Cuenta
    nombre_cuenta: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(1, "Cédula / NIT requerida"),
    telefono: z.string().min(1, "Teléfono requerido"),
    pais_id: z.string().min(1, "País requerido"),
    departamento_id: z.string().optional().nullable(),
    ciudad_id: z.string().optional().nullable(),
    direccion: z.string().optional().nullable(),
    email: z.string().optional().nullable().refine(val => {
        if (!val || val === "" || val === "*****") return true;
        return z.string().email().safeParse(val).success;
    }, { message: "Email inválido" }),
    canal_id: z.string().min(1, "Canal de venta requerido"),
    subclasificacion_id: z.string().min(1, "Subclasificación requerida"),
    
    // Contacto (para cliente existente)
    contacto_nombre: z.string().optional(),
    contacto_cargo: z.string().optional(),
    contacto_email: z.string().optional().nullable().refine(val => {
        if (!val || val.trim() === "") return true;
        return z.string().email().safeParse(val).success;
    }, { message: "Email de contacto inválido" }),
    contacto_telefono: z.string().optional(),
    contacto_comentarios: z.string().optional(),

    // Oportunidad
    fase_id: z.string().min(1, "Fase requerida"),
    amount: z.number().optional().default(0),
    comentarios: z.string().min(1, "Comentario requerido"),
    origen_oportunidad: z.string().min(1, "Origen requerido"),
    venta_feria: z.boolean(),
    categoria_oportunidad: z.string().optional(),
    asesor_id: z.string().min(1, "El asesor es obligatorio"),
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
    fecha_fin: z.string().min(1, "Fecha de vencimiento requerida"),
    clasificacion_id: z.string().min(1, "Clasificación requerida"),
    prioridad: z.enum(["Baja", "Media", "Alta"]),
    actividad_descripcion: z.string().optional()
}).superRefine((data, ctx) => {
    const hasAnyContactField = Boolean(
        data.contacto_nombre?.trim() ||
        data.contacto_cargo?.trim() ||
        data.contacto_email?.trim() ||
        data.contacto_telefono?.trim() ||
        data.contacto_comentarios?.trim()
    );

    if (hasAnyContactField) {
        if (!data.contacto_nombre || data.contacto_nombre.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Nombre completo es obligatorio",
                path: ["contacto_nombre"]
            });
        }
        if (!data.contacto_telefono || data.contacto_telefono.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Teléfono móvil es obligatorio",
                path: ["contacto_telefono"]
            });
        }
    }
});

type StoreSaleFormData = z.infer<typeof storeSaleSchema>;
type StoreSaleItem = StoreSaleFormData["items"][number];

interface CreateStoreSaleFormProps {
    onSuccess?: () => void;
}

// Helper para calcular la fecha de vencimiento por defecto: 7 días después a las 10:00 am
const getDefaultDueDate = () => {
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);
    defaultDueDate.setHours(10, 0, 0, 0);

    const year = defaultDueDate.getFullYear();
    const month = String(defaultDueDate.getMonth() + 1).padStart(2, '0');
    const day = String(defaultDueDate.getDate()).padStart(2, '0');
    const hours = String(defaultDueDate.getHours()).padStart(2, '0');
    const minutes = String(defaultDueDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function CreateStoreSaleForm({ onSuccess }: CreateStoreSaleFormProps) {
    const { createAccount, updateAccount } = useAccounts();
    const { createOpportunity } = useOpportunities();
    const { createActivity } = useActivities();
    const { createContact } = useContacts();
    const { user } = useCurrentUser();
    const { users } = useUsers();
    const { origins, isLoading: isLoadingOrigins } = useOpportunityOrigins();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isActivityExpanded, setIsActivityExpanded] = useState(false);
    const [isContactExpanded, setIsContactExpanded] = useState(false);

    // Estados para búsqueda y selección de cuentas existentes
    const [selectedAccount, setSelectedAccount] = useState<LocalCuenta | null>(null);
    const [accountSearchQuery, setAccountSearchQuery] = useState("");
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [remoteAccounts, setRemoteAccounts] = useState<LocalCuenta[]>([]);
    const accountDropdownRef = useRef<HTMLDivElement>(null);

    const allLocalAccounts = useLiveQuery(() => db.accounts.toArray()) || [];
    
    const { products: searchResults, isLoading: isSearching } = useProductSearch(searchTerm);
    const searchProductIds = useMemo(() => searchResults.map(product => product.id), [searchResults]);
    const { summary: inventorySummary } = useInventorySummary(searchProductIds);
    const inventoryByProduct = useMemo(
        () => new Map(inventorySummary.map(item => [item.producto_id, item])),
        [inventorySummary],
    );

    // Listas locales (Dexie) con Fallback de Supabase
    const countriesList = useLiveQuery(() => db.countries.toArray()) || [];
    const departmentsList = useLiveQuery(() => db.departments.toArray()) || [];
    const citiesList = useLiveQuery(() => db.cities.toArray()) || [];

    const [fallbackCountries, setFallbackCountries] = useState<LocalPais[]>([]);
    const [fallbackDepartments, setFallbackDepartments] = useState<LocalDepartamento[]>([]);
    const [fallbackCities, setFallbackCities] = useState<LocalCiudad[]>([]);

    useEffect(() => {
        if (countriesList.length === 0) {
            supabase.from('CRM_Paises').select('*').order('id').then(({ data }) => {
                if (data) setFallbackCountries(data);
            });
        }
        if (departmentsList.length === 0) {
            supabase.from('CRM_Departamentos').select('*').order('nombre').then(({ data }) => {
                if (data) setFallbackDepartments(data);
            });
        }
        if (citiesList.length === 0) {
            supabase.from('CRM_Ciudades').select('*').order('nombre').then(({ data }) => {
                if (data) setFallbackCities(data);
            });
        }
    }, [countriesList.length, departmentsList.length, citiesList.length]);

    const displayCountries = countriesList.length > 0 ? countriesList : fallbackCountries;
    const displayDepartments = departmentsList.length > 0 ? departmentsList : fallbackDepartments;
    const displayCities = citiesList.length > 0 ? citiesList : fallbackCities;

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
            contacto_nombre: "",
            contacto_cargo: "",
            contacto_email: "",
            contacto_telefono: "",
            contacto_comentarios: "",
            amount: 0,
            fase_id: "",
            comentarios: "",
            origen_oportunidad: "visita",
            venta_feria: false,
            fecha_fin: getDefaultDueDate(),
            clasificacion_id: "",
            prioridad: "Media",
            actividad_descripcion: "",
            items: []
        }
    });

    // Cerrar dropdown de cuentas al hacer clic afuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
                setIsAccountDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Búsqueda remota complementaria en Supabase si está online
    useEffect(() => {
        if (!accountSearchQuery || accountSearchQuery.trim().length < 2 || selectedAccount) return;

        const timer = setTimeout(async () => {
            if (typeof navigator !== "undefined" && navigator.onLine) {
                const tokens = removeAccents(accountSearchQuery).trim().split(/\s+/).filter(Boolean);
                if (tokens.length === 0) return;

                let query = supabase.from('CRM_Cuentas').select('*').limit(20);
                for (const token of tokens) {
                    query = query.ilike('nombre', `%${token}%`);
                }
                const { data } = await query;
                if (data && data.length > 0) {
                    setRemoteAccounts(prev => {
                        const next = [...prev];
                        for (const item of data) {
                            if (!next.some(a => a.id === item.id)) {
                                next.push(item as unknown as LocalCuenta);
                            }
                        }
                        return next;
                    });
                }
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [accountSearchQuery, selectedAccount]);

    // Filtrado de cuentas tokenizado multi-palabra sin importar tildes, mayúsculas ni orden
    const filteredAccounts = useMemo(() => {
        if (!accountSearchQuery || accountSearchQuery.trim().length < 2 || selectedAccount) {
            return [];
        }
        const combined = [...allLocalAccounts];
        for (const remote of remoteAccounts) {
            if (!combined.some(a => a.id === remote.id)) {
                combined.push(remote);
            }
        }
        return combined
            .filter(a => matchesSearchTokens(a.nombre, accountSearchQuery))
            .slice(0, 15);
    }, [accountSearchQuery, allLocalAccounts, remoteAccounts, selectedAccount]);

    const handleSelectAccount = (account: LocalCuenta) => {
        setSelectedAccount(account);
        setAccountSearchQuery(account.nombre);
        setIsAccountDropdownOpen(false);

        setValue("nombre_cuenta", account.nombre);
        setValue("nit_base", "*****");
        setValue("telefono", "*****");
        setValue("email", account.email ? "*****" : "");
        setValue("canal_id", account.canal_id || "PROPIO");
        setValue("subclasificacion_id", account.subclasificacion_id ? String(account.subclasificacion_id) : "");
        setValue("pais_id", account.pais_id ? String(account.pais_id) : "1");
        setValue("departamento_id", account.departamento_id ? String(account.departamento_id) : "");
        setValue("ciudad_id", account.ciudad_id ? String(account.ciudad_id) : "");
        setValue("direccion", account.direccion || "");
        setValue("asesor_id", account.owner_user_id || "");
    };

    const handleDeselectAccount = useCallback(() => {
        setSelectedAccount(null);
        setAccountSearchQuery("");
        setIsAccountDropdownOpen(false);
        setIsContactExpanded(false);

        const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
        const defaultPaisId = colombia ? String(colombia.id) : "1";

        setValue("nombre_cuenta", "");
        setValue("nit_base", "");
        setValue("telefono", "");
        setValue("email", "");
        setValue("canal_id", "PROPIO");
        setValue("subclasificacion_id", "");
        setValue("pais_id", defaultPaisId);
        setValue("departamento_id", "");
        setValue("ciudad_id", "");
        setValue("direccion", "");
        setValue("contacto_nombre", "");
        setValue("contacto_cargo", "");
        setValue("contacto_email", "");
        setValue("contacto_telefono", "");
        setValue("contacto_comentarios", "");
    }, [displayCountries, setValue]);

    const handleNombreCuentaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setAccountSearchQuery(val);
        setValue("nombre_cuenta", val);

        if (selectedAccount) {
            // Si había una cuenta seleccionada y se borra o edita el texto del nombre, resetear a valores por defecto
            setSelectedAccount(null);
            setIsContactExpanded(false);
            setValue("nit_base", "");
            setValue("telefono", "");
            setValue("email", "");
            setValue("canal_id", "PROPIO");
            setValue("subclasificacion_id", "");
            const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
            setValue("pais_id", colombia ? String(colombia.id) : "1");
            setValue("departamento_id", "");
            setValue("ciudad_id", "");
            setValue("direccion", "");
            setValue("contacto_nombre", "");
            setValue("contacto_cargo", "");
            setValue("contacto_email", "");
            setValue("contacto_telefono", "");
            setValue("contacto_comentarios", "");
        }

        if (val.trim().length >= 2) {
            setIsAccountDropdownOpen(true);
        } else {
            setIsAccountDropdownOpen(false);
        }
    };

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

    // Filtrado estricto de asesores: Si el vendedor no tiene país o departamento asignado, NO aparece en el desplegable.
    const selectedPais = watch("pais_id");
    const selectedDept = watch("departamento_id");
    const selectedAdvisorId = watch("asesor_id");

    const filteredAdvisors = useMemo(() => {
        const activeUsers = users?.filter(u => u.is_active) || [];
        
        return activeUsers.filter(u => {
            // 1. Verificar País: El vendedor debe tener al menos un país asignado y debe incluir el país del cliente.
            const userPaises = u.paises && u.paises.length > 0 ? u.paises : (u.pais ? [u.pais] : []);
            if (userPaises.length === 0) return false;

            const matchesCountry = selectedPais && userPaises.includes(String(selectedPais));
            if (!matchesCountry) return false;

            // 2. Verificar Departamento (si se seleccionó departamento en el cliente):
            // El vendedor debe tener asignado al menos un departamento y debe incluir el departamento del cliente.
            if (selectedDept) {
                const userDepts = u.departamentos && u.departamentos.length > 0 ? u.departamentos : (u.departamento ? [u.departamento] : []);
                if (userDepts.length === 0) return false;

                const matchesDept = userDepts.includes(String(selectedDept));
                if (!matchesDept) return false;
            }

            return true;
        });
    }, [users, selectedPais, selectedDept]);

    // Garantizar que Colombia quede seleccionado automáticamente cuando los países terminen de cargar (solo si no hay cuenta seleccionada)
    useEffect(() => {
        if (selectedAccount) return;
        if (displayCountries.length > 0) {
            const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
            const targetId = colombia ? String(colombia.id) : "1";
            const currentPais = watch("pais_id");
            if (!currentPais || currentPais === "") {
                setValue("pais_id", targetId);
            }
        }
    }, [displayCountries, setValue, watch, selectedAccount]);

    // Seleccionar automáticamente un asesor si el actual no pertenece al filtro o está vacío (solo si no hay cuenta seleccionada)
    useEffect(() => {
        if (selectedAccount) return;
        if (filteredAdvisors.length > 0) {
            if (!selectedAdvisorId || !filteredAdvisors.some(u => u.id === selectedAdvisorId)) {
                const juanCorrea = filteredAdvisors.find(u => includesNormalized(u.full_name || "", "juan correa"));
                setValue("asesor_id", juanCorrea ? juanCorrea.id : filteredAdvisors[0].id);
            }
        } else {
            setValue("asesor_id", "");
        }
    }, [filteredAdvisors, selectedAdvisorId, setValue, selectedAccount]);

    // Selección bidireccional: Al seleccionar un asesor, se toma por defecto su país y departamento (solo si no hay cuenta seleccionada)
    useEffect(() => {
        if (selectedAccount) return;
        if (!selectedAdvisorId || !users || users.length === 0) return;

        const advisor = users.find(u => u.id === selectedAdvisorId);
        if (!advisor) return;

        const advPaises = (
            advisor.paises && advisor.paises.length > 0
                ? advisor.paises
                : (advisor.pais ? [advisor.pais] : [])
        ).map(p => String(p));

        const advDepts = (
            advisor.departamentos && advisor.departamentos.length > 0
                ? advisor.departamentos
                : (advisor.departamento ? [advisor.departamento] : [])
        ).map(d => String(d));

        if (advPaises.length > 0 && (!selectedPais || !advPaises.includes(String(selectedPais)))) {
            setValue("pais_id", advPaises[0]);
        }

        if (advDepts.length > 0 && (!selectedDept || !advDepts.includes(String(selectedDept)))) {
            setValue("departamento_id", advDepts[0]);
            setValue("ciudad_id", "");
        }
    }, [selectedAdvisorId, selectedPais, selectedDept, users, setValue, selectedAccount]);

    const resetStoreForm = useCallback(() => {
        setSelectedAccount(null);
        setAccountSearchQuery("");
        setIsAccountDropdownOpen(false);
        setIsContactExpanded(false);

        const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
        const defaultPaisId = colombia ? String(colombia.id) : "1";
        const primerContactoPhase = phasesList.find(p => includesNormalized(p.nombre, "primer contacto"));
        const defaultPhaseId = primerContactoPhase ? String(primerContactoPhase.id) : (phasesList[0] ? String(phasesList[0].id) : "");

        reset({
            nombre_cuenta: "",
            nit_base: "",
            telefono: "",
            pais_id: defaultPaisId,
            departamento_id: "",
            ciudad_id: "",
            direccion: "",
            email: "",
            canal_id: "PROPIO",
            subclasificacion_id: "",
            contacto_nombre: "",
            contacto_cargo: "",
            contacto_email: "",
            contacto_telefono: "",
            contacto_comentarios: "",
            amount: 0,
            fase_id: defaultPhaseId,
            comentarios: "",
            origen_oportunidad: "visita",
            venta_feria: false,
            fecha_fin: getDefaultDueDate(),
            clasificacion_id: "",
            prioridad: "Media",
            actividad_descripcion: "",
            items: []
        });
    }, [reset, displayCountries, phasesList]);

    const watchedItems = watch("items");
    const items = useMemo(() => watchedItems || [], [watchedItems]);

    // Cada canal inicia con la fase "Primer Contacto" por defecto (o su primera fase disponible).
    useEffect(() => {
        const currentPhase = watch("fase_id");
        if (phasesList.length > 0) {
            const primerContactoPhase = phasesList.find(p => includesNormalized(p.nombre, "primer contacto"));
            const defaultPhaseId = primerContactoPhase ? String(primerContactoPhase.id) : String(phasesList[0].id);

            if (!currentPhase || !phasesList.some(phase => String(phase.id) === currentPhase)) {
                setValue("fase_id", defaultPhaseId);
            }
        }
    }, [phasesList, setValue, watch]);

    useEffect(() => {
        if (selectedAccount) return;
        const currentSubclass = watch("subclasificacion_id");
        if (channelSubclassifications.length > 0 && !channelSubclassifications.some(item => String(item.id) === currentSubclass)) {
            setValue("subclasificacion_id", String(channelSubclassifications[0].id));
        }
    }, [channelSubclassifications, setValue, watch, selectedAccount]);

    useEffect(() => {
        const currentOrigin = watch("origen_oportunidad");
        if (origins.length > 0 && !origins.some(origin => origin.codigo === currentOrigin)) {
            setValue("origen_oportunidad", origins[0].codigo);
        }
    }, [origins, setValue, watch]);

    // Seleccionar automáticamente la clasificación "Llamada telefónica" por defecto
    useEffect(() => {
        if (classifications.length > 0) {
            const currentClasif = watch("clasificacion_id");
            if (!currentClasif) {
                const callClasif = classifications.find(c => 
                    includesNormalized(c.nombre, "llamada")
                ) || eventClassifications[0] || classifications[0];
                
                if (callClasif) {
                    setValue("clasificacion_id", String(callClasif.id));
                }
            }
        }
    }, [classifications, eventClassifications, setValue, watch]);

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

            let accountId = "";

            if (selectedAccount) {
                // Usar directamente la cuenta existente seleccionada sin sobreescribir datos sensibles
                accountId = selectedAccount.id;
                console.log("Usando cuenta existente seleccionada:", accountId);
            } else {
                // VALIDACIÓN DE DUPLICADOS LOCALES
                const duplicates = await db.accounts.filter(a => 
                    a.nit_base === data.nit_base || (!!a.telefono && a.telefono === data.telefono)
                ).toArray();

                if (duplicates.length > 0) {
                    // Usar el cliente existente
                    accountId = duplicates[0].id;
                    await updateAccount(accountId, {
                        ...duplicates[0],
                        canal_id: data.canal_id,
                        subclasificacion_id: Number(data.subclasificacion_id),
                    });
                    console.log("Cliente ya existe por NIT/teléfono, usando ID existente:", accountId);
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
            }

            if (!accountId) {
                throw new Error("No se pudo obtener el ID de la cuenta.");
            }

            // 2. Crear Contacto (si se especificó en cliente existente)
            if (selectedAccount && data.contacto_nombre && data.contacto_nombre.trim() !== "") {
                await createContact({
                    account_id: accountId,
                    nombre: data.contacto_nombre.trim(),
                    cargo: data.contacto_cargo?.trim() || undefined,
                    email: data.contacto_email?.trim() || undefined,
                    telefono: data.contacto_telefono?.trim() || undefined,
                    comentarios: data.contacto_comentarios?.trim() || undefined,
                });
            }

            // 3. Crear Oportunidad
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
                owner_user_id: selectedAccount?.owner_user_id || data.asesor_id || user?.id,
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
                fecha_inicio: data.fecha_fin,
                fecha_fin: data.fecha_fin,
                prioridad: data.prioridad,
                user_id: selectedAccount?.owner_user_id || data.asesor_id || user?.id,
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-800">
                                    <Store className="w-5 h-5" /> Datos del Cliente
                                </h3>
                                {selectedAccount && (
                                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                                        <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span>Cliente existente · Datos protegidos</span>
                                        <button
                                            type="button"
                                            onClick={handleDeselectAccount}
                                            className="ml-1 text-blue-600 hover:text-blue-900 font-bold underline"
                                        >
                                            Limpiar / Desvincular
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative" ref={accountDropdownRef}>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Nombre de la Cuenta / Cliente *</span>
                                        {selectedAccount && (
                                            <span className="text-[11px] text-blue-600 font-normal">
                                                (Cuenta vinculada)
                                            </span>
                                        )}
                                    </label>
                                    <div className="relative mt-1">
                                        <input 
                                            {...register("nombre_cuenta")}
                                            onChange={handleNombreCuentaChange}
                                            onFocus={() => {
                                                if (accountSearchQuery.trim().length >= 2 && !selectedAccount) {
                                                    setIsAccountDropdownOpen(true);
                                                }
                                            }}
                                            className={cn(
                                                "w-full border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none pr-10",
                                                selectedAccount && "bg-blue-50/50 border-blue-300 font-semibold text-slate-900"
                                            )} 
                                            placeholder="Buscar cuenta existente o escribir nombre..."
                                            autoComplete="off"
                                        />
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            {selectedAccount ? (
                                                <button
                                                    type="button"
                                                    onClick={handleDeselectAccount}
                                                    className="p-1 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors text-xs font-bold"
                                                    title="Desvincular cuenta y volver a editar"
                                                >
                                                    ✕
                                                </button>
                                            ) : (
                                                <Search className="w-4 h-4 text-slate-400 pointer-events-none" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Menú flotante de resultados de búsqueda */}
                                    {isAccountDropdownOpen && filteredAccounts.length > 0 && !selectedAccount && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                                            <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                                <span>Cuentas existentes encontradas</span>
                                                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
                                                    {filteredAccounts.length}
                                                </span>
                                            </div>
                                            {filteredAccounts.map(account => (
                                                <button
                                                    key={account.id}
                                                    type="button"
                                                    onClick={() => handleSelectAccount(account)}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 transition-colors flex items-center justify-between group"
                                                >
                                                    <div className="overflow-hidden pr-2">
                                                        <div className="font-semibold text-sm text-slate-800 group-hover:text-blue-900 truncate">
                                                            {account.nombre}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                            <span className="font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                                                                {account.canal_id}
                                                            </span>
                                                            {account.nit_base && (
                                                                <span className="text-slate-400">NIT: *****</span>
                                                            )}
                                                            {account.ciudad && (
                                                                <span className="text-slate-400 truncate">· {account.ciudad}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white border border-blue-200 px-2 py-1 rounded-md transition-colors">
                                                        Seleccionar
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {errors.nombre_cuenta && <p className="text-red-500 text-xs mt-1">{errors.nombre_cuenta.message}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Cédula / NIT *</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("nit_base")} 
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="123456789" 
                                    />
                                    {errors.nit_base && <p className="text-red-500 text-xs mt-1">{errors.nit_base.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Teléfono *</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("telefono")} 
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="300 000 0000" 
                                    />
                                    {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Email (Opcional)</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("email")} 
                                        type={selectedAccount ? "text" : "email"}
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="correo@ejemplo.com" 
                                    />
                                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Canal de Venta *</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select 
                                        {...register("canal_id")}
                                        value={watch("canal_id") || "PROPIO"}
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    >
                                        {SALES_CHANNELS.map(channel => <option key={channel.id} value={channel.id}>{channel.nombre}</option>)}
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1">El canal o tipo de cuenta define la lista de precios aplicada.</p>
                                    {errors.canal_id && <p className="text-red-500 text-xs mt-1">{errors.canal_id.message}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Subclasificación *</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select 
                                        {...register("subclasificacion_id")}
                                        value={watch("subclasificacion_id") || ""}
                                        disabled={!!selectedAccount || !selectedChannel || (channelSubclassifications.length === 0 && !selectedAccount)} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {channelSubclassifications.length === 0 && !selectedAccount && <option value="">Sin opciones sincronizadas</option>}
                                        {selectedAccount && selectedAccount.subclasificacion_id && !channelSubclassifications.some(item => String(item.id) === String(selectedAccount.subclasificacion_id)) && (
                                            <option value={String(selectedAccount.subclasificacion_id)}>
                                                {subclassifications.find(s => String(s.id) === String(selectedAccount.subclasificacion_id))?.nombre || "Subclasificación Asignada"}
                                            </option>
                                        )}
                                        {channelSubclassifications.map(item => <option key={item.id} value={String(item.id)}>{item.nombre}</option>)}
                                    </select>
                                    {errors.subclasificacion_id && <p className="text-red-500 text-xs mt-1">{errors.subclasificacion_id.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>País</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select
                                        {...register("pais_id")}
                                        value={watch("pais_id") || ""}
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        onChange={(e) => {
                                            register("pais_id").onChange(e);
                                            setValue("departamento_id", "");
                                            setValue("ciudad_id", "");
                                        }}
                                    >
                                        <option value="">Seleccione...</option>
                                        {displayCountries.map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Departamento</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select
                                        {...register("departamento_id")}
                                        value={watch("departamento_id") || ""}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        disabled={!!selectedAccount || !watch("pais_id")}
                                        onChange={(e) => {
                                            register("departamento_id").onChange(e);
                                            setValue("ciudad_id", "");
                                        }}
                                    >
                                        <option value="">Seleccione...</option>
                                        {displayDepartments
                                            .filter(dep => String(dep.pais_id) === watch("pais_id"))
                                            .map(dep => (
                                                <option key={dep.id} value={String(dep.id)}>{dep.nombre}</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Ciudad</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select
                                        {...register("ciudad_id")}
                                        value={watch("ciudad_id") || ""}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        disabled={!!selectedAccount || !watch("departamento_id")}
                                    >
                                        <option value="">Seleccione...</option>
                                        {displayCities
                                            .filter(c => String(c.departamento_id) === watch("departamento_id"))
                                            .map(city => (
                                                <option key={city.id} value={String(city.id)}>{city.nombre}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="text-sm font-semibold text-blue-900 flex items-center justify-between">
                                        <span>Asesor Encargado del Cliente *</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select 
                                        {...register("asesor_id")} 
                                        value={watch("asesor_id") || ""}
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Seleccione un asesor...</option>
                                        {selectedAccount && selectedAccount.owner_user_id && !filteredAdvisors.some(u => u.id === selectedAccount.owner_user_id) && (
                                            <option value={selectedAccount.owner_user_id}>
                                                {users?.find(u => u.id === selectedAccount.owner_user_id)?.full_name || users?.find(u => u.id === selectedAccount.owner_user_id)?.email || "Asesor Asignado"}
                                            </option>
                                        )}
                                        {filteredAdvisors.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.full_name || u.email}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1">El cliente queda anclado primariamente a este asesor desde su creación.</p>
                                    {errors.asesor_id && (
                                        <p className="text-red-500 text-xs mt-1">{errors.asesor_id.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Dirección (Opcional)</span>
                                        {selectedAccount && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("direccion")} 
                                        disabled={!!selectedAccount}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="Calle/Carrera" 
                                    />
                                </div>
                            </div>
                        </section>

                        {/* SECCIÓN CONTACTO (Solo cuando se selecciona un cliente existente) */}
                        {selectedAccount && (
                            <section className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 transition-all">
                                <div 
                                    onClick={() => setIsContactExpanded(!isContactExpanded)}
                                    className="flex items-center justify-between cursor-pointer select-none"
                                >
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-800">
                                        <UserPlus className="w-5 h-5 text-indigo-600" /> Contacto del Cliente
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        {!isContactExpanded && (
                                            <span className="hidden sm:inline-block bg-indigo-100/80 text-indigo-800 px-2.5 py-1 rounded-full border border-indigo-200/70 font-semibold text-[11px]">
                                                {watch("contacto_nombre") ? `Contacto: ${watch("contacto_nombre")}` : "+ Agregar nuevo contacto (Opcional)"}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            className="p-1 hover:bg-indigo-200/60 rounded-lg text-indigo-700 transition-colors"
                                            aria-label="Expandir o colapsar sección de contacto"
                                        >
                                            {isContactExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                
                                {isContactExpanded && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-indigo-200/60">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Nombre Completo *</label>
                                            <input 
                                                {...register("contacto_nombre")} 
                                                className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                placeholder="Nombre y apellidos" 
                                            />
                                            {errors.contacto_nombre && <p className="text-red-500 text-xs mt-1">{errors.contacto_nombre.message}</p>}
                                        </div>
                                        
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Cargo / Posición</label>
                                            <input 
                                                {...register("contacto_cargo")} 
                                                className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                placeholder="Ej. Gerente de Compras, Arquitecto" 
                                            />
                                            {errors.contacto_cargo && <p className="text-red-500 text-xs mt-1">{errors.contacto_cargo.message}</p>}
                                        </div>
                                        
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Correo Electrónico</label>
                                            <input 
                                                {...register("contacto_email")} 
                                                type="email"
                                                className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                placeholder="contacto@ejemplo.com" 
                                            />
                                            {errors.contacto_email && <p className="text-red-500 text-xs mt-1">{errors.contacto_email.message}</p>}
                                        </div>
                                        
                                        <div>
                                            <label className="text-sm font-medium text-slate-700">Teléfono Móvil *</label>
                                            <input 
                                                {...register("contacto_telefono")} 
                                                className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                placeholder="300 000 0000" 
                                            />
                                            {errors.contacto_telefono && <p className="text-red-500 text-xs mt-1">{errors.contacto_telefono.message}</p>}
                                        </div>
                                        
                                        <div className="md:col-span-2">
                                            <label className="text-sm font-medium text-slate-700">Comentarios</label>
                                            <textarea 
                                                {...register("contacto_comentarios")} 
                                                rows={2}
                                                className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                                                placeholder="Notas sobre el contacto, disponibilidad o canal preferido..." 
                                            />
                                            {errors.contacto_comentarios && <p className="text-red-500 text-xs mt-1">{errors.contacto_comentarios.message}</p>}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* SECCIÓN OPORTUNIDAD */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-700 border-b pb-2">
                                <DollarSign className="w-5 h-5" /> Datos del Negocio (Oportunidad)
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all">
                            <div 
                                onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                                className="flex items-center justify-between cursor-pointer select-none"
                            >
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-600">
                                    <CalendarPlus className="w-5 h-5" /> Actividad Programada
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    {!isActivityExpanded && (
                                        <span className="hidden sm:inline-block bg-orange-100/80 text-orange-800 px-2.5 py-1 rounded-full border border-orange-200/70 font-semibold text-[11px]">
                                            Llamada Telefónica · Prioridad Media (Vence en 7 días)
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-600 transition-colors"
                                        aria-label="Expandir o colapsar sección de actividad"
                                    >
                                        {isActivityExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            
                            {isActivityExpanded && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700">Clasificación *</label>
                                        <select 
                                            {...register("clasificacion_id")} 
                                            className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none"
                                        >
                                            <option value="">Seleccione...</option>
                                            {(eventClassifications.length > 0 ? eventClassifications : classifications).map(c => (
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
                                    
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-slate-700">Fecha y Hora de Vencimiento *</label>
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
                            )}
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
