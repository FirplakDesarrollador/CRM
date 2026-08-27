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
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { OPPORTUNITY_CATEGORIES, formatOpportunityCategories, parseOpportunityCategories } from "@/lib/opportunityCategories";

// Eschema de validación combinado
const storeSaleSchema = z.object({
    // Cuenta
    nombre_cuenta: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().optional().nullable(),
    telefono: z.string().optional().nullable(),
    pais_id: z.string().optional().nullable(),
    departamento_id: z.string().optional().nullable(),
    ciudad_id: z.string().optional().nullable(),
    direccion: z.string().optional().nullable(),
    email: z.string().optional().nullable().refine(val => {
        if (!val || val === "" || val === "*****") return true;
        return z.string().email().safeParse(val).success;
    }, { message: "Email inválido" }),
    canal_id: z.string().optional().nullable(),
    subclasificacion_id: z.string().optional().nullable(),
    
    // Contactos (para cliente nuevo o existente)
    contactos_ids: z.array(z.string()),
    clientes_atendidos: z.number().min(0),
    contacto_nombre: z.string().optional(),
    contacto_cargo: z.string().optional(),
    contacto_email: z.string().optional().nullable().refine(val => {
        if (!val || val.trim() === "") return true;
        return z.string().email().safeParse(val).success;
    }, { message: "Email de contacto inválido" }),
    contacto_telefono: z.string().optional(),
    contacto_comentarios: z.string().optional(),

    // Oportunidad (Opcional - con autogeneración)
    nombre_oportunidad: z.string().optional().nullable(),
    fase_id: z.string().optional().nullable(),
    amount: z.number().optional().nullable(),
    comentarios: z.string().optional().nullable(),
    origen_oportunidad: z.string().optional().nullable(),
    venta_feria: z.boolean().optional(),
    categoria_oportunidad: z.union([z.array(z.string()), z.string()]).optional().nullable(),
    asesor_id: z.string().optional().nullable(),
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

    // Actividad (Opcional - con defaults)
    fecha_fin: z.string().optional().nullable(),
    clasificacion_id: z.string().optional().nullable(),
    prioridad: z.enum(["Baja", "Media", "Alta"]),
    actividad_descripcion: z.string().optional()
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
    const { user, isAdmin } = useCurrentUser();
    const { users } = useUsers();
    const { origins, isLoading: isLoadingOrigins } = useOpportunityOrigins();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);
    const [isActivityExpanded, setIsActivityExpanded] = useState(false);
    const [isContactExpanded, setIsContactExpanded] = useState(false);

    // Estados para búsqueda y selección de cuentas existentes
    const [selectedAccount, setSelectedAccount] = useState<LocalCuenta | null>(null);
    const [accountSearchQuery, setAccountSearchQuery] = useState("");
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [remoteAccounts, setRemoteAccounts] = useState<LocalCuenta[]>([]);
    const accountDropdownRef = useRef<HTMLDivElement>(null);

    const allLocalAccounts = useLiveQuery(() => db.accounts.toArray()) || [];

    // Contactos de la cuenta seleccionada (locales en Dexie + remotos en Supabase)
    const localAccountContacts = useLiveQuery(
        () => selectedAccount ? db.contacts.where('account_id').equals(selectedAccount.id).filter(c => !c.is_deleted).toArray() : [],
        [selectedAccount?.id]
    ) || [];

    const [remoteAccountContacts, setRemoteAccountContacts] = useState<any[]>([]);

    useEffect(() => {
        setRemoteAccountContacts([]);
        if (!selectedAccount?.id) {
            return;
        }
        let isMounted = true;
        if (typeof navigator !== "undefined" && navigator.onLine) {
            supabase
                .from('CRM_Contactos')
                .select('*')
                .eq('account_id', selectedAccount.id)
                .eq('is_deleted', false)
                .then(({ data }) => {
                    if (isMounted && data) {
                        setRemoteAccountContacts(data);
                    }
                });
        }
        return () => {
            isMounted = false;
        };
    }, [selectedAccount?.id]);

    const accountContacts = useMemo(() => {
        const map = new Map<string, any>();
        localAccountContacts.forEach(c => map.set(c.id, c));
        remoteAccountContacts.forEach(c => {
            if (!map.has(c.id)) map.set(c.id, c);
        });
        return Array.from(map.values());
    }, [localAccountContacts, remoteAccountContacts]);

    const contactOptions = useMemo(() => {
        return accountContacts.map(c => ({
            value: c.id,
            label: `${c.nombre}${c.cargo ? ` (${c.cargo})` : ''}${c.telefono ? ` - ${c.telefono}` : ''}`
        }));
    }, [accountContacts]);

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
            contactos_ids: [],
            clientes_atendidos: 1,
            contacto_nombre: "",
            contacto_cargo: "",
            contacto_email: "",
            contacto_telefono: "",
            contacto_comentarios: "",
            amount: 0,
            nombre_oportunidad: "",
            fase_id: "",
            comentarios: "",
            origen_oportunidad: "",
            categoria_oportunidad: [],
            venta_feria: false,
            fecha_fin: getDefaultDueDate(),
            clasificacion_id: "",
            prioridad: "Media",
            actividad_descripcion: "",
            items: [],
            asesor_id: ""
        }
    });

    const isFairSale = watch("venta_feria") || false;
    const { summary: globalInventorySummary } = useInventorySummary();
    const inventoryByProduct = useMemo(
        () => new Map(globalInventorySummary.map(item => [item.producto_id, item])),
        [globalInventorySummary],
    );

    const fairProductIds = useMemo(() => {
        if (!isFairSale) return undefined;
        return globalInventorySummary
            .filter(item => (item.disponible || 0) > 0)
            .map(item => item.producto_id);
    }, [isFairSale, globalInventorySummary]);

    const { products: searchResults, isLoading: isSearching } = useProductSearch(
        searchTerm,
        undefined,
        isFairSale,
        undefined,
        undefined,
        {
            onlyFeria: isFairSale,
            productIds: isFairSale ? fairProductIds : undefined
        }
    );

    // Cerrar dropdowns (cuentas y productos) al hacer clic o tap afuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            const target = event.target as Node;
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(target)) {
                setIsAccountDropdownOpen(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
                setIsProductDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
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

    // Detección temprana en tiempo real de cuentas duplicadas por NIT, Teléfono o Email
    const watchedNit = watch("nit_base");
    const watchedTelefono = watch("telefono");
    const watchedEmail = watch("email");

    const [remoteDuplicateAccounts, setRemoteDuplicateAccounts] = useState<LocalCuenta[]>([]);

    useEffect(() => {
        if (selectedAccount) return;
        const cleanNit = (watchedNit || "").replace(/\D/g, "");
        const cleanPhone = (watchedTelefono || "").replace(/\D/g, "");
        const cleanMail = (watchedEmail || "").trim().toLowerCase();

        const needsNitSearch = cleanNit.length >= 5 && watchedNit !== "*****" && !allLocalAccounts.some(a => (a.nit_base || "").replace(/\D/g, "") === cleanNit);
        const needsPhoneSearch = cleanPhone.length >= 7 && watchedTelefono !== "*****" && !allLocalAccounts.some(a => (a.telefono || "").replace(/\D/g, "") === cleanPhone);
        const needsEmailSearch = cleanMail.includes("@") && cleanMail.length >= 6 && watchedEmail !== "*****" && !allLocalAccounts.some(a => (a.email || "").trim().toLowerCase() === cleanMail);

        if (!needsNitSearch && !needsPhoneSearch && !needsEmailSearch) return;

        const timer = setTimeout(async () => {
            if (typeof navigator !== "undefined" && navigator.onLine) {
                let orConditions: string[] = [];
                if (needsNitSearch) orConditions.push(`nit_base.eq.${cleanNit}`);
                if (needsPhoneSearch) orConditions.push(`telefono.eq.${cleanPhone}`);
                if (needsEmailSearch) orConditions.push(`email.ilike.${cleanMail}`);

                if (orConditions.length > 0) {
                    const { data } = await supabase
                        .from('CRM_Cuentas')
                        .select('*')
                        .or(orConditions.join(','))
                        .limit(5);

                    if (data && data.length > 0) {
                        setRemoteDuplicateAccounts(prev => {
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
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [watchedNit, watchedTelefono, watchedEmail, selectedAccount, allLocalAccounts]);

    const duplicateAccountByNit = useMemo(() => {
        if (selectedAccount || !watchedNit || watchedNit === "*****") return null;
        const clean = (watchedNit || "").replace(/\D/g, "");
        if (clean.length < 5) return null;
        return allLocalAccounts.find(a => (a.nit_base || "").replace(/\D/g, "") === clean) ||
               remoteDuplicateAccounts.find(a => (a.nit_base || "").replace(/\D/g, "") === clean) || null;
    }, [watchedNit, allLocalAccounts, remoteDuplicateAccounts, selectedAccount]);

    const duplicateAccountByPhone = useMemo(() => {
        if (selectedAccount || !watchedTelefono || watchedTelefono === "*****") return null;
        const clean = (watchedTelefono || "").replace(/\D/g, "");
        if (clean.length < 7) return null;
        return allLocalAccounts.find(a => (a.telefono || "").replace(/\D/g, "") === clean) ||
               remoteDuplicateAccounts.find(a => (a.telefono || "").replace(/\D/g, "") === clean) || null;
    }, [watchedTelefono, allLocalAccounts, remoteDuplicateAccounts, selectedAccount]);

    const duplicateAccountByEmail = useMemo(() => {
        if (selectedAccount || !watchedEmail || watchedEmail === "*****") return null;
        const clean = (watchedEmail || "").trim().toLowerCase();
        if (!clean.includes("@") || clean.length < 6) return null;
        return allLocalAccounts.find(a => (a.email || "").trim().toLowerCase() === clean) ||
               remoteDuplicateAccounts.find(a => (a.email || "").trim().toLowerCase() === clean) || null;
    }, [watchedEmail, allLocalAccounts, remoteDuplicateAccounts, selectedAccount]);

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
            .filter(a => matchesSearchTokens([a.nombre, a.nit_base, a.ciudad, a.telefono], accountSearchQuery))
            .slice(0, 15);
    }, [accountSearchQuery, allLocalAccounts, remoteAccounts, selectedAccount]);

    const handleSelectAccount = (account: LocalCuenta) => {
        setSelectedAccount(account);
        setAccountSearchQuery(account.nombre);
        setIsAccountDropdownOpen(false);

        setValue("nombre_cuenta", account.nombre);

        // Si es ADMIN, siempre cargar los valores reales legibles
        if (isAdmin) {
            setValue("nit_base", account.nit_base || "");
            setValue("telefono", account.telefono || "");
            setValue("email", account.email || "");
        } else {
            // Para vendedores, enmascarar únicamente si el dato existe
            setValue("nit_base", account.nit_base ? "*****" : "");
            setValue("telefono", account.telefono ? "*****" : "");
            setValue("email", account.email ? "*****" : "");
        }

        const luisGuillermo = users?.find(u => 
            (u.full_name && includesNormalized(u.full_name, "luis guillermo")) ||
            (u.email && includesNormalized(u.email, "luis.escobar")) ||
            u.id === "bc4209dd-cf19-4a97-b4c5-ed8d11d94965"
        );
        const defaultAdvisor = account.owner_user_id || luisGuillermo?.id || user?.id || "";
        const advisorUser = users?.find(u => u.id === defaultAdvisor);
        const advisorFirstChannel = advisorUser?.canales?.[0] || (user?.id === defaultAdvisor ? user.canales?.[0] : null) || "PROPIO";
        const channel = account.canal_id || advisorFirstChannel;
        setValue("canal_id", channel);

        const subclasificacionVal = account.subclasificacion_id ? String(account.subclasificacion_id) : "";
        setValue("subclasificacion_id", subclasificacionVal);

        setValue("pais_id", account.pais_id ? String(account.pais_id) : "1");
        setValue("departamento_id", account.departamento_id ? String(account.departamento_id) : "");
        setValue("ciudad_id", account.ciudad_id ? String(account.ciudad_id) : "");
        setValue("direccion", account.direccion || "");
        setValue("asesor_id", defaultAdvisor);
        setValue("contactos_ids", []);
        setValue("clientes_atendidos", 1);
        setValue("contacto_nombre", "");
        setValue("contacto_cargo", "");
        setValue("contacto_email", "");
        setValue("contacto_telefono", "");
        setValue("contacto_comentarios", "");
        if (!watch("nombre_oportunidad")) {
            setValue("nombre_oportunidad", `Venta - ${account.nombre}`);
        }
    };

    const handleDeselectAccount = useCallback(() => {
        setSelectedAccount(null);
        setAccountSearchQuery("");
        setIsAccountDropdownOpen(false);

        const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
        const defaultPaisId = colombia ? String(colombia.id) : "1";

        const defaultAdvisorId = user?.id || "";
        const currentUserData = users?.find(u => u.id === defaultAdvisorId);
        const defaultChannel = currentUserData?.canales?.[0] || user?.canales?.[0] || "PROPIO";

        setValue("nombre_cuenta", "");
        setValue("nit_base", "");
        setValue("telefono", "");
        setValue("email", "");
        setValue("canal_id", defaultChannel);
        setValue("subclasificacion_id", "");
        setValue("pais_id", defaultPaisId);
        setValue("departamento_id", "");
        setValue("ciudad_id", "");
        setValue("direccion", "");
        setValue("contactos_ids", []);
        setValue("clientes_atendidos", 1);
        setValue("contacto_nombre", "");
        setValue("contacto_cargo", "");
        setValue("contacto_email", "");
        setValue("contacto_telefono", "");
        setValue("contacto_comentarios", "");
        setValue("nombre_oportunidad", "");
        setValue("asesor_id", defaultAdvisorId);
    }, [displayCountries, setValue, user, users]);

    const handleNombreCuentaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setAccountSearchQuery(val);
        setValue("nombre_cuenta", val);

        const currentOppName = watch("nombre_oportunidad");
        if (!currentOppName || currentOppName.startsWith("Venta - ")) {
            setValue("nombre_oportunidad", val ? `Venta - ${val}` : "");
        }

        if (selectedAccount) {
            // Si había una cuenta seleccionada y se borra o edita el texto del nombre, resetear a valores por defecto
            setSelectedAccount(null);
            const defaultAdvisorId = user?.id || "";
            const currentUserData = users?.find(u => u.id === defaultAdvisorId);
            const defaultChannel = currentUserData?.canales?.[0] || user?.canales?.[0] || "PROPIO";

            setValue("nit_base", "");
            setValue("telefono", "");
            setValue("email", "");
            setValue("canal_id", defaultChannel);
            setValue("subclasificacion_id", "");
            const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
            setValue("pais_id", colombia ? String(colombia.id) : "1");
            setValue("departamento_id", "");
            setValue("ciudad_id", "");
            setValue("direccion", "");
            setValue("contactos_ids", []);
            setValue("clientes_atendidos", 1);
            setValue("contacto_nombre", "");
            setValue("contacto_cargo", "");
            setValue("contacto_email", "");
            setValue("contacto_telefono", "");
            setValue("contacto_comentarios", "");
            setValue("asesor_id", defaultAdvisorId);
        }

        if (val.trim().length >= 2) {
            setIsAccountDropdownOpen(true);
        } else {
            setIsAccountDropdownOpen(false);
        }
    };

    // Auto-asignar el usuario actual como asesor por defecto y su primer canal si no hay ninguno seleccionado
    const hasInitializedAdvisorRef = useRef(false);
    useEffect(() => {
        if (user?.id && !selectedAccount && !hasInitializedAdvisorRef.current) {
            const currentAsesor = watch("asesor_id");
            const targetAdvisorId = currentAsesor || user.id;
            setValue("asesor_id", targetAdvisorId);

            const advisorUser = users?.find(u => u.id === targetAdvisorId);
            const advisorChannels = advisorUser?.canales || (user.id === targetAdvisorId ? user.canales : null);

            if (advisorChannels && advisorChannels.length > 0) {
                const firstChannel = advisorChannels[0];
                setValue("canal_id", firstChannel);
                hasInitializedAdvisorRef.current = true;
            } else if (users && users.length > 0) {
                hasInitializedAdvisorRef.current = true;
            }
        }
    }, [user, selectedAccount, setValue, watch, users]);

    const selectedChannel = watch("canal_id") || "PROPIO";
    const phasesQuery = useLiveQuery(
        () => db.phases.where("canal_id").equals(selectedChannel).sortBy("orden"),
        [selectedChannel],
    );
    const phasesList = useMemo(() => phasesQuery || [], [phasesQuery]);
    const channelSubclassifications = useMemo(
        () => subclassifications.filter(item => item.canal_id === selectedChannel),
        [subclassifications, selectedChannel],
    );

    // Filtrado estricto de asesores: Valida que el asesor pertenezca al canal, país y departamento seleccionados.
    const selectedPais = watch("pais_id");
    const selectedDept = watch("departamento_id");

    const filteredAdvisors = useMemo(() => {
        const activeUsers = users?.filter(u => u.is_active) || [];
        
        return activeUsers.filter(u => {
            // 1. Verificar Canal de Venta: El vendedor debe tener asignado el canal seleccionado
            const userChannels = u.canales || [];
            if (userChannels.length === 0 || !userChannels.includes(selectedChannel)) {
                return false;
            }

            // 2. Verificar País: El vendedor debe tener asignado el país seleccionado
            if (selectedPais) {
                const userPaises = u.paises && u.paises.length > 0 ? u.paises : (u.pais ? [String(u.pais)] : ["1"]);
                if (!userPaises.includes(String(selectedPais))) {
                    return false;
                }
            }

            // 3. Verificar Departamento (si se seleccionó departamento en el formulario):
            if (selectedDept) {
                const userDepts = u.departamentos && u.departamentos.length > 0 ? u.departamentos : (u.departamento ? [String(u.departamento)] : []);
                // En Canal Propio, si el asesor no tiene restricción de departamento, opera a nivel general de tienda
                if (selectedChannel === "PROPIO" && userDepts.length === 0) {
                    return true;
                }
                // En canales OBRAS y DISTRIBUCIÓN, la asignación de departamento es estricta por zona
                if (userDepts.length === 0 || !userDepts.includes(String(selectedDept))) {
                    return false;
                }
            }

            return true;
        });
    }, [users, selectedPais, selectedDept, selectedChannel]);

    const advisorOptions = useMemo(() => {
        const list: { value: string; label: string }[] = [];
        const seenIds = new Set<string>();

        const currentAsesorId = watch("asesor_id");
        if (currentAsesorId) {
            const foundUser = users?.find(u => u.id === currentAsesorId);
            if (foundUser) {
                list.push({
                    value: foundUser.id,
                    label: foundUser.full_name || foundUser.email || `Usuario ${foundUser.id}`
                });
                seenIds.add(foundUser.id);
            }
        }

        if (selectedAccount?.owner_user_id && !seenIds.has(selectedAccount.owner_user_id)) {
            const assignedUser = users?.find(u => u.id === selectedAccount.owner_user_id);
            list.push({
                value: selectedAccount.owner_user_id,
                label: assignedUser?.full_name || assignedUser?.email || "Asesor Asignado"
            });
            seenIds.add(selectedAccount.owner_user_id);
        }

        const luisGuillermo = users?.find(u => 
            (u.full_name && includesNormalized(u.full_name, "luis guillermo")) ||
            (u.email && includesNormalized(u.email, "luis.escobar")) ||
            u.id === "bc4209dd-cf19-4a97-b4c5-ed8d11d94965"
        );
        if (luisGuillermo && !seenIds.has(luisGuillermo.id)) {
            list.push({
                value: luisGuillermo.id,
                label: luisGuillermo.full_name || luisGuillermo.email
            });
            seenIds.add(luisGuillermo.id);
        }

        filteredAdvisors.forEach(u => {
            if (!seenIds.has(u.id)) {
                list.push({
                    value: u.id,
                    label: u.full_name || u.email || `Usuario ${u.id}`
                });
                seenIds.add(u.id);
            }
        });

        const activeUsers = users?.filter(u => u.is_active) || [];
        activeUsers.forEach(u => {
            if (!seenIds.has(u.id)) {
                list.push({
                    value: u.id,
                    label: u.full_name || u.email || `Usuario ${u.id}`
                });
                seenIds.add(u.id);
            }
        });

        return list;
    }, [filteredAdvisors, selectedAccount, users, watch("asesor_id")]);

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

    const resetStoreForm = useCallback(() => {
        setSelectedAccount(null);
        setAccountSearchQuery("");
        setIsAccountDropdownOpen(false);
        setIsContactExpanded(true);

        const colombia = displayCountries.find(c => includesNormalized(c.nombre, "colombia")) || displayCountries.find(c => String(c.id) === "1");
        const defaultPaisId = colombia ? String(colombia.id) : "1";

        const defaultAdvisorId = user?.id || "";
        const currentUserData = users?.find(u => u.id === defaultAdvisorId);
        const defaultChannel = currentUserData?.canales?.[0] || user?.canales?.[0] || "PROPIO";

        const primerContactoPhase = phasesList.find(p => p.canal_id === defaultChannel && includesNormalized(p.nombre, "primer contacto"));
        const defaultPhaseId = primerContactoPhase ? String(primerContactoPhase.id) : (phasesList.find(p => p.canal_id === defaultChannel) ? String(phasesList.find(p => p.canal_id === defaultChannel)!.id) : "");

        reset({
            nombre_cuenta: "",
            nit_base: "",
            telefono: "",
            pais_id: defaultPaisId,
            departamento_id: "",
            ciudad_id: "",
            direccion: "",
            email: "",
            canal_id: defaultChannel,
            subclasificacion_id: "",
            contactos_ids: [],
            clientes_atendidos: 1,
            contacto_nombre: "",
            contacto_cargo: "",
            contacto_email: "",
            contacto_telefono: "",
            contacto_comentarios: "",
            amount: 0,
            nombre_oportunidad: "",
            fase_id: defaultPhaseId,
            comentarios: "",
            origen_oportunidad: origins.find(o => o.is_default && o.is_active)?.codigo || origins.find(o => o.is_active)?.codigo || "",
            categoria_oportunidad: [],
            venta_feria: false,
            fecha_fin: getDefaultDueDate(),
            clasificacion_id: "",
            prioridad: "Media",
            actividad_descripcion: "",
            items: [],
            asesor_id: defaultAdvisorId
        });
    }, [reset, displayCountries, phasesList, origins, user, users]);

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
        const currentOrigin = watch("origen_oportunidad");
        if (origins.length > 0) {
            const defaultOrigin = origins.find(o => o.is_default && o.is_active) || origins.find(o => o.is_active) || origins[0];
            if (!currentOrigin || !origins.some(origin => origin.codigo === currentOrigin)) {
                setValue("origen_oportunidad", defaultOrigin.codigo);
            }
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
        const repriced = items.map(item => {
            const newPrice = getProductPrice(item, selectedChannel, isFairSale);
            const inv = inventoryByProduct.get(item.product_id);
            const available = inv?.disponible !== undefined ? inv.disponible : item.inventario_disponible;
            return {
                ...item,
                precio: newPrice,
                inventario_disponible: available
            };
        });
        if (repriced.some((item, index) => item.precio !== items[index].precio || item.inventario_disponible !== items[index].inventario_disponible)) {
            setValue("items", repriced);
        }
    }, [selectedChannel, isFairSale, items, setValue, inventoryByProduct]);

    const addProduct = (product: PriceListProduct) => {
        const price = getProductPrice(product, selectedChannel, isFairSale);
        const available = inventoryByProduct.get(product.id)?.disponible || 0;
        if (isFairSale && price <= 0) {
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

    const updateQuantity = (productId: string, qty: number | string) => {
        const num = typeof qty === "number" ? qty : parseInt(qty);
        if (isNaN(num)) {
            setValue("items", items.map(current => current.product_id === productId ? { ...current, cantidad: 0 } : current));
            return;
        }
        let validQty = Math.max(1, num);
        const item = items.find(current => current.product_id === productId);
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

            const luisGuillermoUser = users?.find(u => 
                (u.full_name && includesNormalized(u.full_name, "luis guillermo")) ||
                (u.email && includesNormalized(u.email, "luis.escobar")) ||
                u.id === "bc4209dd-cf19-4a97-b4c5-ed8d11d94965"
            );
            const resolvedAdvisorId = selectedAccount?.owner_user_id || data.asesor_id || luisGuillermoUser?.id || user?.id;

            if (selectedAccount) {
                accountId = selectedAccount.id;
                // Si es admin o completó datos faltantes en la cuenta vinculada, actualizarla
                const hasUpdates = isAdmin || !selectedAccount.subclasificacion_id || !selectedAccount.telefono || !selectedAccount.email || !selectedAccount.departamento_id
                    || (!!data.origen_oportunidad && selectedAccount.origen_cuenta !== data.origen_oportunidad)
                    || (!selectedAccount.owner_user_id && !!resolvedAdvisorId);
                if (hasUpdates) {
                    await updateAccount(accountId, {
                        ...selectedAccount,
                        nombre: data.nombre_cuenta || selectedAccount.nombre,
                        nit_base: data.nit_base && data.nit_base !== "*****" ? data.nit_base.trim() : selectedAccount.nit_base,
                        telefono: data.telefono && data.telefono !== "*****" ? data.telefono : selectedAccount.telefono,
                        email: data.email && data.email !== "*****" ? data.email : selectedAccount.email,
                        canal_id: data.canal_id || selectedAccount.canal_id,
                        subclasificacion_id: data.subclasificacion_id ? Number(data.subclasificacion_id) : selectedAccount.subclasificacion_id,
                        pais_id: data.pais_id ? Number(data.pais_id) : selectedAccount.pais_id,
                        departamento_id: data.departamento_id ? Number(data.departamento_id) : selectedAccount.departamento_id,
                        ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : selectedAccount.ciudad_id,
                        ciudad: data.ciudad_id ? displayCities.find(c => String(c.id) === data.ciudad_id)?.nombre : selectedAccount.ciudad,
                        direccion: data.direccion || selectedAccount.direccion,
                        owner_user_id: selectedAccount.owner_user_id || resolvedAdvisorId,
                        origen_cuenta: data.origen_oportunidad || selectedAccount.origen_cuenta,
                    });
                }
                console.log("Usando cuenta existente seleccionada:", accountId);
            } else {
                // VALIDACIÓN DE DUPLICADOS LOCALES Y REMOTOS (NIT, Teléfono o Email)
                const cleanNit = (data.nit_base || "").replace(/\D/g, "");
                const cleanPhone = (data.telefono || "").replace(/\D/g, "");
                const cleanMail = (data.email || "").trim().toLowerCase();

                const matchedAccount = duplicateAccountByNit || duplicateAccountByPhone || duplicateAccountByEmail || (
                    allLocalAccounts.find(a => 
                        (cleanNit.length >= 5 && (a.nit_base || "").replace(/\D/g, "") === cleanNit) ||
                        (cleanPhone.length >= 7 && (a.telefono || "").replace(/\D/g, "") === cleanPhone) ||
                        (cleanMail.length >= 6 && (a.email || "").trim().toLowerCase() === cleanMail)
                    )
                );

                if (matchedAccount) {
                    // Usar el cliente existente
                    accountId = matchedAccount.id;
                    const matchedSubId = data.subclasificacion_id ? Number(data.subclasificacion_id) : (matchedAccount.subclasificacion_id || null);
                    await updateAccount(accountId, {
                        ...matchedAccount,
                        canal_id: data.canal_id || matchedAccount.canal_id || "PROPIO",
                        subclasificacion_id: matchedSubId,
                        origen_cuenta: data.origen_oportunidad || matchedAccount.origen_cuenta,
                        owner_user_id: matchedAccount.owner_user_id || resolvedAdvisorId
                    });
                    console.log("Cliente ya existe por NIT/teléfono/email, usando ID existente:", accountId);
                } else {
                    // 1. Crear Cuenta si no existe
                    const chosenCanal = data.canal_id || "PROPIO";
                    const chosenSubId = data.subclasificacion_id ? Number(data.subclasificacion_id) : null;

                    const accountData = {
                        nombre: data.nombre_cuenta,
                        nit_base: data.nit_base?.trim() || undefined,
                        canal_id: chosenCanal,
                        subclasificacion_id: chosenSubId,
                        telefono: data.telefono || undefined,
                        email: data.email || undefined,
                        direccion: data.direccion || undefined,
                        pais_id: data.pais_id ? Number(data.pais_id) : 1,
                        departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
                        ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null,
                        // Conservamos compatibilidad string con DB usando displayCities
                        ciudad: data.ciudad_id ? (displayCities.find(c => String(c.id) === data.ciudad_id)?.nombre || undefined) : undefined,
                        es_premium: false,
                        origen_cuenta: data.origen_oportunidad || undefined,
                        owner_user_id: resolvedAdvisorId
                    };

                    const initialContact = data.contacto_nombre?.trim() ? {
                        nombre: data.contacto_nombre.trim(),
                        cargo: data.contacto_cargo?.trim() || undefined,
                        email: data.contacto_email?.trim() || undefined,
                        telefono: data.contacto_telefono?.trim() || undefined,
                        comentarios: data.contacto_comentarios?.trim() || undefined,
                    } : undefined;

                    const newId = await createAccount(accountData, initialContact);
                    if (newId) {
                        accountId = newId;
                    }
                }
            }

            if (!accountId) {
                throw new Error("No se pudo obtener el ID de la cuenta.");
            }

            // 2. Manejo de contactos (existentes seleccionados + nuevo contacto opcional)
            let finalContactosIds: string[] = Array.isArray(data.contactos_ids) ? [...data.contactos_ids] : [];

            // Si se especificó un nuevo contacto para un cliente existente y no es duplicado
            if (selectedAccount && data.contacto_nombre && data.contacto_nombre.trim() !== "") {
                const existingContacts = await db.contacts.where('account_id').equals(accountId).toArray();
                const isPhoneDuplicate = data.contacto_telefono?.trim() && existingContacts.some(c => c.telefono === data.contacto_telefono?.trim() && !c.is_deleted);

                if (!isPhoneDuplicate) {
                    const newContactId = await createContact({
                        account_id: accountId,
                        nombre: data.contacto_nombre.trim(),
                        cargo: data.contacto_cargo?.trim() || undefined,
                        email: data.contacto_email?.trim() || undefined,
                        telefono: data.contacto_telefono?.trim() || undefined,
                        comentarios: data.contacto_comentarios?.trim() || undefined,
                    });
                    if (newContactId && !finalContactosIds.includes(newContactId)) {
                        finalContactosIds.push(newContactId);
                    }
                }
            }

            // Si es una cuenta nueva, obtener el contacto asociado creado
            if (!selectedAccount) {
                try {
                    const newlyCreatedContacts = await db.contacts.where('account_id').equals(accountId).toArray();
                    for (const c of newlyCreatedContacts) {
                        if (c.id && !finalContactosIds.includes(c.id)) {
                            finalContactosIds.push(c.id);
                        }
                    }
                } catch (e) {
                    console.warn("Could not retrieve contacts for new account:", e);
                }
            }

            const attendedCount = typeof data.clientes_atendidos === 'number' && !isNaN(data.clientes_atendidos) && data.clientes_atendidos >= 1
                ? data.clientes_atendidos
                : (finalContactosIds.length > 0 ? finalContactosIds.length : 1);

            // 3. Crear Oportunidad
            const formattedCategories = formatOpportunityCategories(data.categoria_oportunidad);
            const commentsText = data.comentarios?.trim() || "";
            const combinedComentarios = formattedCategories ? 
                (commentsText ? `Categorías: ${formattedCategories}\n\n${commentsText}` : `Categorías: ${formattedCategories}`) 
                : (commentsText || "Registro desde feria/tienda");

            const defaultOppName = data.nombre_cuenta ? `Venta - ${data.nombre_cuenta}` : "Venta en Tienda";
            const oppName = data.nombre_oportunidad?.trim() || defaultOppName;
            const finalFaseId = data.fase_id ? Number(data.fase_id) : (phasesList[0]?.id ? Number(phasesList[0].id) : 1);
            const finalOrigen = data.origen_oportunidad || (origins[0]?.codigo || "visita");

            const opportunityData = {
                account_id: accountId,
                nombre: oppName,
                amount: data.amount || 0,
                fase_id: finalFaseId,
                estado_id: 1, // OPEN
                currency_id: "COP",
                origen_oportunidad: finalOrigen,
                categoria_oportunidad: formattedCategories || undefined,
                comentarios: combinedComentarios,
                items: data.items || [],
                owner_user_id: resolvedAdvisorId,
                contactos_ids: finalContactosIds,
                clientes_atendidos: attendedCount,
            };
            const opportunityId = await createOpportunity(opportunityData);

            if (!opportunityId) {
                throw new Error("No se pudo obtener el ID de la oportunidad.");
            }

            if (data.venta_feria && data.items && data.items.length > 0) {
                try {
                    await reserveFairInventory(data.items, opportunityId);
                } catch (invErr) {
                    console.warn("Aviso al reservar inventario de feria (se reintentará en sync):", invErr);
                }
            }

            // 3. Crear Actividad
            const defaultClasif = eventClassifications[0]?.id || classifications[0]?.id || 1;
            const finalClasifId = data.clasificacion_id ? Number(data.clasificacion_id) : Number(defaultClasif);
            const finalFechaFin = data.fecha_fin || getDefaultDueDate();

            const activityData = {
                opportunity_id: opportunityId,
                account_id: accountId,
                clasificacion_id: finalClasifId,
                tipo_actividad: "EVENTO",
                descripcion: data.actividad_descripcion || "Seguimiento de venta en tienda",
                fecha_inicio: finalFechaFin,
                fecha_fin: finalFechaFin,
                prioridad: data.prioridad || "Media",
                user_id: resolvedAdvisorId,
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

    const onInvalid = (formErrors: any) => {
        console.warn("[CreateStoreSaleForm] Errores de validación:", formErrors);
        const errorKeys = Object.keys(formErrors);
        if (errorKeys.length > 0) {
            const firstKey = errorKeys[0];
            const firstMsg = formErrors[firstKey]?.message || "Por favor verifica los campos obligatorios.";
            alert(`No se puede guardar: ${firstMsg}`);
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
                    <form id="store-sale-form" onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                        
                        {/* SECCIÓN 1: DATOS PRINCIPALES (CLIENTE Y OPORTUNIDAD) */}
                        <section className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-800">
                                    <Store className="w-5 h-5" /> Datos Principales
                                </h3>
                                {selectedAccount && (
                                    <div className={cn(
                                        "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border",
                                        isAdmin ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-blue-50 border-blue-200 text-blue-800"
                                    )}>
                                        {isAdmin ? (
                                            <>
                                                <span className="font-semibold">Cliente vinculado · Modo Administrador (Edición total)</span>
                                                <button
                                                    type="button"
                                                    onClick={handleDeselectAccount}
                                                    className="ml-1 text-emerald-900 hover:text-emerald-950 font-bold underline"
                                                >
                                                    Limpiar / Desvincular
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                <span>Cliente existente · Datos protegidos</span>
                                                <button
                                                    type="button"
                                                    onClick={handleDeselectAccount}
                                                    className="ml-1 text-blue-600 hover:text-blue-900 font-bold underline"
                                                >
                                                    Limpiar / Desvincular
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 1. Nombre de la Cuenta / Cliente * */}
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
                                                "w-full border p-2.5 sm:p-2 text-base sm:text-sm rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none pr-10 min-h-[42px]",
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
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors text-xs font-bold"
                                                    title="Desvincular cuenta y volver a editar"
                                                >
                                                    ✕
                                                </button>
                                            ) : accountSearchQuery.length > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAccountSearchQuery("");
                                                        setValue("nombre_cuenta", "");
                                                        setIsAccountDropdownOpen(false);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-md transition-colors text-xs font-bold"
                                                    title="Limpiar búsqueda"
                                                >
                                                    ✕
                                                </button>
                                            ) : (
                                                <Search className="w-4 h-4 text-slate-400 pointer-events-none" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Menú flotante de resultados de búsqueda */}
                                    {isAccountDropdownOpen && !selectedAccount && accountSearchQuery.trim().length >= 2 && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 overscroll-contain">
                                            {filteredAccounts.length > 0 ? (
                                                <>
                                                    <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
                                                        <span>Cuentas existentes encontradas</span>
                                                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                                                            {filteredAccounts.length}
                                                        </span>
                                                    </div>
                                                    {filteredAccounts.map(account => (
                                                        <button
                                                            key={account.id}
                                                            type="button"
                                                            onClick={() => handleSelectAccount(account)}
                                                            className="w-full text-left px-3.5 py-3 sm:py-2.5 hover:bg-blue-50/80 active:bg-blue-100 transition-colors flex items-center justify-between group cursor-pointer"
                                                        >
                                                            <div className="overflow-hidden pr-2 flex-1">
                                                                <div className="font-semibold text-sm text-slate-800 group-hover:text-blue-900 truncate">
                                                                    {account.nombre}
                                                                </div>
                                                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                                    <span className="font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded shrink-0">
                                                                        {account.canal_id}
                                                                    </span>
                                                                    {account.nit_base && (
                                                                        <span className="text-slate-400 shrink-0">NIT: {isAdmin ? account.nit_base : "*****"}</span>
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
                                                </>
                                            ) : (
                                                <div className="p-3 text-center text-xs text-slate-500 bg-slate-50">
                                                    No se encontraron cuentas existentes. Se creará como cliente nuevo.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {errors.nombre_cuenta && <p className="text-red-500 text-xs mt-1">{errors.nombre_cuenta.message}</p>}
                                </div>

                                {/* 2. Teléfono * */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Teléfono *</span>
                                        {selectedAccount && !isAdmin && !!selectedAccount.telefono && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("telefono")} 
                                        disabled={!isAdmin && !!selectedAccount && !!selectedAccount.telefono}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="300 000 0000" 
                                    />
                                    {duplicateAccountByPhone && (
                                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                                            <div className="text-amber-800 font-medium flex items-center gap-1.5 truncate">
                                                <span>⚠️ Ya existe:</span>
                                                <span className="font-bold truncate">{duplicateAccountByPhone.nombre}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectAccount(duplicateAccountByPhone)}
                                                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2 py-0.5 rounded text-[11px] shadow-sm transition-colors flex items-center gap-1"
                                            >
                                                ⚡ Vincular
                                            </button>
                                        </div>
                                    )}
                                    {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono.message}</p>}
                                </div>

                                {/* 3. Email (Opcional) */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Email (Opcional)</span>
                                        {selectedAccount && !isAdmin && !!selectedAccount.email && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("email")} 
                                        type={selectedAccount && !isAdmin && !!selectedAccount.email ? "text" : "email"}
                                        disabled={!isAdmin && !!selectedAccount && !!selectedAccount.email}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="correo@ejemplo.com" 
                                    />
                                    {duplicateAccountByEmail && (
                                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                                            <div className="text-amber-800 font-medium flex items-center gap-1.5 truncate">
                                                <span>⚠️ Ya existe:</span>
                                                <span className="font-bold truncate">{duplicateAccountByEmail.nombre}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectAccount(duplicateAccountByEmail)}
                                                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2 py-0.5 rounded text-[11px] shadow-sm transition-colors flex items-center gap-1"
                                            >
                                                ⚡ Vincular
                                            </button>
                                        </div>
                                    )}
                                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                                </div>

                                {/* 4. Categorías de Interés (Opcional) */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Categorías de Interés (Opcional)</label>
                                    <MultiSelect
                                        options={OPPORTUNITY_CATEGORIES}
                                        selected={parseOpportunityCategories(watch("categoria_oportunidad"))}
                                        onChange={(vals) => setValue("categoria_oportunidad", vals, { shouldValidate: true })}
                                        placeholder="Seleccionar categorías..."
                                        className="mt-1"
                                    />
                                </div>

                                {/* 5. Comentarios * - de la oportunidad */}
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Comentarios * (Oportunidad)</label>
                                    <textarea 
                                        {...register("comentarios")} 
                                        rows={3}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                                        placeholder="Detalles sobre el negocio o productos interesados..." 
                                    />
                                    {errors.comentarios && <p className="text-red-500 text-xs mt-1">{errors.comentarios.message}</p>}
                                </div>
                            </div>
                        </section>

                        {/* SECCIÓN 2: DATOS DE UBICACIÓN Y CUENTA */}
                        <section className="space-y-4 pt-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800 border-b pb-2">
                                Datos de Ubicación y Cuenta
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Cédula / NIT</span>
                                        {selectedAccount && !isAdmin && !!selectedAccount.nit_base && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("nit_base")} 
                                        disabled={!isAdmin && !!selectedAccount && !!selectedAccount.nit_base}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="123456789" 
                                    />
                                    {duplicateAccountByNit && (
                                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                                            <div className="text-amber-800 font-medium flex items-center gap-1.5 truncate">
                                                <span>⚠️ Ya existe:</span>
                                                <span className="font-bold truncate">{duplicateAccountByNit.nombre}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectAccount(duplicateAccountByNit)}
                                                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2 py-0.5 rounded text-[11px] shadow-sm transition-colors flex items-center gap-1"
                                            >
                                                ⚡ Vincular
                                            </button>
                                        </div>
                                    )}
                                    {errors.nit_base && <p className="text-red-500 text-xs mt-1">{errors.nit_base.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Canal de Venta
                                    </label>
                                    <select 
                                        {...register("canal_id")}
                                        value={watch("canal_id") || "PROPIO"}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                        onChange={(e) => {
                                            const newChannel = e.target.value;
                                            register("canal_id").onChange(e);
                                            setValue("subclasificacion_id", "");
                                            setValue("asesor_id", "");
                                            const firstPhase = phasesList.find(p => p.canal_id === newChannel);
                                            if (firstPhase) {
                                                setValue("fase_id", String(firstPhase.id));
                                            }
                                        }}
                                    >
                                        {SALES_CHANNELS.map(channel => <option key={channel.id} value={channel.id}>{channel.nombre}</option>)}
                                    </select>
                                    <p className="text-[11px] text-slate-500 mt-1">El canal o tipo de cuenta define la lista de precios aplicada.</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Subclasificación</span>
                                        <span className="text-[11px] text-slate-400 font-normal">(Opcional)</span>
                                    </label>
                                    <select 
                                        {...register("subclasificacion_id")}
                                        value={watch("subclasificacion_id") || ""}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Seleccionar (Opcional)...</option>
                                        {selectedAccount && selectedAccount.subclasificacion_id && !channelSubclassifications.some(item => String(item.id) === String(selectedAccount.subclasificacion_id)) && (
                                            <option value={String(selectedAccount.subclasificacion_id)}>
                                                {subclassifications.find(s => String(s.id) === String(selectedAccount.subclasificacion_id))?.nombre || "Subclasificación Asignada"}
                                            </option>
                                        )}
                                        {channelSubclassifications.map(item => <option key={item.id} value={String(item.id)}>{item.nombre}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>País</span>
                                        {selectedAccount && !isAdmin && !!selectedAccount.pais_id && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select
                                        {...register("pais_id")}
                                        value={watch("pais_id") || ""}
                                        disabled={!isAdmin && !!selectedAccount && !!selectedAccount.pais_id}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        onChange={(e) => {
                                            register("pais_id").onChange(e);
                                            setValue("departamento_id", "");
                                            setValue("ciudad_id", "");
                                            setValue("asesor_id", "");
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
                                        {selectedAccount && !isAdmin && !!selectedAccount.departamento_id && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select
                                        {...register("departamento_id")}
                                        value={watch("departamento_id") || ""}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        disabled={(!isAdmin && !!selectedAccount && !!selectedAccount.departamento_id) || !watch("pais_id")}
                                        onChange={(e) => {
                                            register("departamento_id").onChange(e);
                                            setValue("ciudad_id", "");
                                            setValue("asesor_id", "");
                                        }}
                                    >
                                        <option value="">Seleccione...</option>
                                        {displayDepartments
                                            .filter(dep => String(dep.pais_id) === watch("pais_id") || (!dep.pais_id && watch("pais_id") === "1"))
                                            .map(dep => (
                                                <option key={dep.id} value={String(dep.id)}>{dep.nombre}</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Ciudad</span>
                                        {selectedAccount && !isAdmin && !!selectedAccount.ciudad_id && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <select
                                        {...register("ciudad_id")}
                                        value={watch("ciudad_id") || ""}
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        disabled={(!isAdmin && !!selectedAccount && !!selectedAccount.ciudad_id) || !watch("departamento_id")}
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
                                        {selectedAccount && !isAdmin && !!selectedAccount.owner_user_id && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <div className="mt-1">
                                        <SearchableSelect
                                            options={advisorOptions}
                                            value={watch("asesor_id") || ""}
                                            onChange={(val) => {
                                                setValue("asesor_id", val, { shouldValidate: true });
                                                if (val) {
                                                    const selectedAdvisor = users?.find(u => u.id === val);
                                                    const advisorChannels = selectedAdvisor?.canales || (user?.id === val ? user.canales : null);
                                                    if (advisorChannels && advisorChannels.length > 0) {
                                                        const defaultChannel = advisorChannels[0];
                                                        setValue("canal_id", defaultChannel);
                                                        setValue("subclasificacion_id", "");
                                                    }
                                                }
                                            }}
                                            placeholder="Seleccione un asesor..."
                                            searchPlaceholder="Buscar asesor por nombre..."
                                            emptyText="No se encontraron asesores disponibles."
                                            disabled={!isAdmin && !!selectedAccount && !!selectedAccount.owner_user_id}
                                            triggerClassName={cn(
                                                "border-blue-300 font-medium text-slate-800",
                                                (!isAdmin && !!selectedAccount && !!selectedAccount.owner_user_id) && "bg-slate-100 text-slate-500 cursor-not-allowed"
                                            )}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">El cliente queda anclado primariamente a este asesor desde su creación.</p>
                                    {filteredAdvisors.length === 0 && !selectedAccount && (
                                        <p className="text-[11px] text-amber-600 font-medium mt-1">
                                            No hay asesores asignados para el país, departamento y canal seleccionado.
                                        </p>
                                    )}
                                    {errors.asesor_id && (
                                        <p className="text-red-500 text-xs mt-1">{errors.asesor_id.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Dirección (Opcional)</span>
                                        {selectedAccount && !isAdmin && !!selectedAccount.direccion && <Lock className="w-3 h-3 text-slate-400" />}
                                    </label>
                                    <input 
                                        {...register("direccion")} 
                                        disabled={!isAdmin && !!selectedAccount && !!selectedAccount.direccion}
                                        className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                                        placeholder="Calle/Carrera" 
                                    />
                                </div>
                            </div>
                        </section>

                        {/* SECCIÓN CONTACTO (Habilitada permanentemente para cuentas nuevas y existentes) */}
                        <section className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 transition-all">
                            <div 
                                onClick={() => setIsContactExpanded(!isContactExpanded)}
                                className="flex items-center justify-between cursor-pointer select-none"
                            >
                                <div className="flex items-center gap-2">
                                    <UserPlus className="w-5 h-5 text-indigo-600" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-indigo-900">
                                            Contacto del Cliente
                                        </h3>
                                        <p className="text-xs text-indigo-700">
                                            Todos los campos de contacto son opcionales.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    {!isContactExpanded && (
                                        <span className="hidden sm:inline-block bg-indigo-100/80 text-indigo-800 px-2.5 py-1 rounded-full border border-indigo-200/70 font-semibold text-[11px]">
                                            {watch("contacto_nombre") 
                                                ? `Contacto: ${watch("contacto_nombre")}` 
                                                : ((watch("contactos_ids")?.length || 0) > 0
                                                    ? `${watch("contactos_ids")?.length} contacto(s) seleccionado(s)` 
                                                    : "+ Información de contacto (Opcional)")}
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
                                <div className="space-y-4 pt-3 border-t border-indigo-200/60">
                                    {/* Multi-select de contactos existentes (si la cuenta seleccionada tiene contactos) */}
                                    {selectedAccount && (
                                        <div className="bg-white/80 p-3.5 rounded-xl border border-indigo-100 space-y-2">
                                            <label className="text-sm font-semibold text-indigo-900 block">
                                                Contactos vinculados a la cuenta (Selección múltiple)
                                            </label>
                                            {contactOptions.length > 0 ? (
                                                <MultiSelect
                                                    options={contactOptions}
                                                    selected={watch("contactos_ids") || []}
                                                    onChange={(vals) => {
                                                        setValue("contactos_ids", vals);
                                                        // Auto-actualizar clientes atendidos con el conteo de contactos seleccionados (mínimo 1)
                                                        setValue("clientes_atendidos", vals.length > 0 ? vals.length : 1);
                                                    }}
                                                    placeholder="Seleccionar uno o más contactos de la cuenta..."
                                                />
                                            ) : (
                                                <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                    Esta cuenta no tiene contactos registrados previamente. Puedes registrar uno nuevo a continuación.
                                                </p>
                                            )}
                                            <p className="text-[11px] text-slate-500">
                                                Selecciona los contactos de esta cuenta vinculados a la oportunidad.
                                            </p>
                                        </div>
                                    )}

                                    {/* Campo Clientes Atendidos */}
                                    <div className="bg-white/80 p-3.5 rounded-xl border border-indigo-100">
                                        <label className="text-sm font-semibold text-indigo-900 flex items-center justify-between">
                                            <span>Clientes atendidos</span>
                                            <span className="text-[11px] text-indigo-600 font-normal">
                                                (Editable · Calculado automáticamente)
                                            </span>
                                        </label>
                                        <div className="mt-1 flex items-center gap-3">
                                            <input 
                                                type="number"
                                                min="0"
                                                {...register("clientes_atendidos", { valueAsNumber: true })}
                                                className="w-32 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-base font-semibold text-slate-800"
                                                placeholder="1" 
                                            />
                                            <span className="text-xs text-slate-500">
                                                Contabiliza cuántas personas o clientes se atendieron en esta oportunidad.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Formulario de nuevo contacto (opcional) */}
                                    <div className="pt-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3">
                                            {selectedAccount ? "Registrar un contacto adicional (Opcional)" : "Datos del contacto (Opcional)"}
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Nombre Completo (Opcional)</label>
                                                <input 
                                                    {...register("contacto_nombre")} 
                                                    className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                    placeholder="Nombre y apellidos" 
                                                />
                                                {errors.contacto_nombre && <p className="text-red-500 text-xs mt-1">{errors.contacto_nombre.message}</p>}
                                            </div>
                                            
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Cargo / Posición (Opcional)</label>
                                                <input 
                                                    {...register("contacto_cargo")} 
                                                    className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                    placeholder="Ej. Gerente de Compras, Arquitecto" 
                                                />
                                                {errors.contacto_cargo && <p className="text-red-500 text-xs mt-1">{errors.contacto_cargo.message}</p>}
                                            </div>
                                            
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Correo Electrónico (Opcional)</label>
                                                <input 
                                                    {...register("contacto_email")} 
                                                    type="email"
                                                    className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                    placeholder="contacto@ejemplo.com" 
                                                />
                                                {errors.contacto_email && <p className="text-red-500 text-xs mt-1">{errors.contacto_email.message}</p>}
                                            </div>
                                            
                                            <div>
                                                <label className="text-sm font-medium text-slate-700">Teléfono Móvil (Opcional)</label>
                                                <input 
                                                    {...register("contacto_telefono")} 
                                                    className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                                    placeholder="300 000 0000" 
                                                />
                                                {errors.contacto_telefono && <p className="text-red-500 text-xs mt-1">{errors.contacto_telefono.message}</p>}
                                            </div>
                                            
                                            <div className="md:col-span-2">
                                                <label className="text-sm font-medium text-slate-700">Comentarios (Opcional)</label>
                                                <textarea 
                                                    {...register("contacto_comentarios")} 
                                                    rows={2}
                                                    className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                                                    placeholder="Notas sobre el contacto, disponibilidad o canal preferido..." 
                                                />
                                                {errors.contacto_comentarios && <p className="text-red-500 text-xs mt-1">{errors.contacto_comentarios.message}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* SECCIÓN OPORTUNIDAD */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-green-700 border-b pb-2">
                                <DollarSign className="w-5 h-5" /> Datos del Negocio (Oportunidad)
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
                                        <span>Nombre de la Oportunidad</span>
                                        <span className="text-[11px] text-slate-400 font-normal">(Opcional · Autogenerado)</span>
                                    </label>
                                    <input 
                                        {...register("nombre_oportunidad")} 
                                        className="w-full mt-1 border p-2 rounded-lg bg-white border-slate-300 focus:ring-2 focus:ring-green-500 outline-none" 
                                        placeholder={watch("nombre_cuenta") ? `Venta - ${watch("nombre_cuenta")}` : "Venta en Tienda"} 
                                    />
                                    {errors.nombre_oportunidad && <p className="text-red-500 text-xs mt-1">{errors.nombre_oportunidad.message}</p>}
                                </div>

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
                                <div className="relative mt-1 mb-3" ref={productDropdownRef}>
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-full pl-10 pr-10 py-2.5 sm:py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 text-base sm:text-sm min-h-[42px]"
                                        placeholder={isFairSale ? "Buscar productos de feria disponibles (o ver lista)..." : "Buscar más productos para agregar..."}
                                        value={searchTerm}
                                        onFocus={() => {
                                            if (isFairSale || searchTerm.trim().length > 0) setIsProductDropdownOpen(true);
                                        }}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setIsProductDropdownOpen(true);
                                        }}
                                    />
                                    {searchTerm.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm("");
                                                if (!isFairSale) setIsProductDropdownOpen(false);
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 active:bg-slate-200 rounded-md text-xs font-bold transition-colors"
                                            title="Limpiar búsqueda de productos"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    {isProductDropdownOpen && (isFairSale || searchTerm.trim().length > 0) && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto overscroll-contain divide-y divide-slate-100">
                                            {isSearching ? (
                                                <div className="p-4 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-green-600" /> Buscando...
                                                </div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="p-4 text-center text-slate-500 text-xs sm:text-sm">
                                                    {isFairSale ? "No se encontraron productos de feria disponibles con inventario" : "No se encontraron productos"}
                                                </div>
                                            ) : (
                                                searchResults.map((product: PriceListProduct) => {
                                                    const displayPrice = getProductPrice(product, selectedChannel, isFairSale);
                                                    const inventory = inventoryByProduct.get(product.id);
                                                    const unavailable = isFairSale && (!inventory || inventory.disponible < 1);

                                                    return (
                                                        <button
                                                            key={product.id}
                                                            type="button"
                                                            onClick={() => {
                                                                addProduct(product);
                                                                setIsProductDropdownOpen(false);
                                                            }}
                                                            disabled={unavailable}
                                                            className="w-full text-left px-3.5 py-3 sm:py-2.5 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 border-b last:border-0 transition-colors cursor-pointer"
                                                        >
                                                            <div className="min-w-0 flex-1 pr-2">
                                                                <div className="font-medium text-sm text-slate-900 truncate">{product.descripcion}</div>
                                                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                                                    {product.numero_articulo} · {inventory?.disponible !== undefined ? `Disponible: ${inventory.disponible}` : "Sin inventario"}
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-bold text-blue-600 shrink-0">
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
                                                        min="1"
                                                        className="w-16 p-1 border rounded text-center text-sm font-semibold focus:ring-2 focus:ring-green-500 outline-none"
                                                        value={item.cantidad === 0 ? "" : item.cantidad}
                                                        onChange={(e) => updateQuantity(item.product_id, e.target.value === "" ? "" : parseInt(e.target.value))}
                                                        onBlur={() => {
                                                            if (!item.cantidad || item.cantidad < 1) {
                                                                updateQuantity(item.product_id, 1);
                                                            }
                                                        }}
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

                                    {/* Resumen Total de Productos y Valor */}
                                    {items.length > 0 && (
                                        <div className="mt-3 p-3 bg-green-50/80 border border-green-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                                            <div className="text-xs text-green-800 font-medium">
                                                <span>Total productos: <strong className="text-green-900">{items.reduce((acc, curr) => acc + (curr.cantidad || 0), 0)}</strong> unidad(es)</span>
                                                {isFairSale && (
                                                    <span className="block text-[11px] text-amber-700 font-semibold mt-0.5">
                                                        ✨ Precios especiales de feria aplicados
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-baseline gap-1.5 self-end sm:self-auto">
                                                <span className="text-xs text-green-700 font-medium">Total:</span>
                                                <span className="text-base font-bold text-green-900">
                                                    COP $ {new Intl.NumberFormat().format(watch("amount") || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
