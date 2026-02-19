"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db, LocalCuenta } from "@/lib/db";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState, useEffect } from "react";
import { Loader2, User, Building2, Medal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AccountContactsTab from "./AccountContactsTab";
import AccountOpportunitiesTab from "./AccountOpportunitiesTab";
import { Briefcase } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { AccountAssignedTab } from "./AccountAssignedTab";

// Schema
const accountSchema = z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(5, "NIT requerido"),
    is_child: z.boolean(),
    id_cuenta_principal: z.string().nullable().optional(),
    canal_id: z.string().min(1, "Canal de venta requerido"),
    subclasificacion_id: z.string().optional().nullable(), // Form uses string, convert to number on submit
    telefono: z.string().nullable().optional(),
    email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
    direccion: z.string().nullable().optional(),
    departamento_id: z.string().nullable().optional(),
    ciudad_id: z.string().nullable().optional(),
    ciudad: z.string().nullable().optional(), // Keep for backward compat
    es_premium: z.boolean().optional(),
    nivel_premium: z.enum(['ORO', 'PLATA', 'BRONCE']).nullable().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    account?: LocalCuenta; // Existing account to edit
}

export function AccountForm({ onSuccess, onCancel, account }: AccountFormProps) {
    const { createAccount, updateAccount } = useAccounts();
    const { role: userRole } = useCurrentUser();
    const [parents, setParents] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'info' | 'contacts' | 'opportunities' | 'assigned'>('info');

    // Live Query for Subclassifications from local DB
    const subclassifications = useLiveQuery(() => db.subclasificaciones.toArray()) || [];
    const departmentsList = useLiveQuery(() => db.departments.toArray()) || [];
    const citiesList = useLiveQuery(() => db.cities.toArray()) || [];

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assignedUserName, setAssignedUserName] = useState<string | null>(null);
    const [fallbackSubclassifications, setFallbackSubclassifications] = useState<any[]>([]);
    const [fallbackDepartments, setFallbackDepartments] = useState<any[]>([]);
    const [fallbackCities, setFallbackCities] = useState<any[]>([]);

    useEffect(() => {
        if (subclassifications.length === 0) {
            console.log('[AccountForm] INFO - Local subclasificaciones empty, fetching fallback from server...');
            supabase
                .from('CRM_Subclasificacion')
                .select('id, nombre, canal_id')
                .then(({ data }) => {
                    if (data) setFallbackSubclassifications(data);
                });
        }

        if (departmentsList.length === 0) {
            console.log('[AccountForm] INFO - Local departments empty, fetching fallback...');
            supabase
                .from('CRM_Departamentos')
                .select('*')
                .then(({ data }) => {
                    if (data) setFallbackDepartments(data);
                });
        }

        if (citiesList.length === 0) {
            console.log('[AccountForm] INFO - Local cities empty, fetching fallback...');
            supabase
                .from('CRM_Ciudades')
                .select('*')
                .then(({ data }) => {
                    if (data) setFallbackCities(data);
                });
        }
    }, [subclassifications.length, departmentsList.length, citiesList.length]);

    const displaySubclassifications = subclassifications.length > 0 ? subclassifications : fallbackSubclassifications;
    const displayDepartments = departmentsList.length > 0 ? departmentsList : fallbackDepartments;
    const displayCities = citiesList.length > 0 ? citiesList : fallbackCities;

    // Fetch assigned user name if exists
    useEffect(() => {
        // 1. Try owner_name from server join (new field)
        if ((account as any)?.owner_name) {
            setAssignedUserName((account as any).owner_name);
            return;
        }

        // 2. Fallback: creator_name (legacy)
        if ((account as any)?.creator_name) {
            setAssignedUserName((account as any).creator_name);
            return;
        }

        // 3. Fetch manually using owner_user_id or created_by
        const ownerId = (account as any)?.owner_user_id || account?.created_by;

        if (ownerId) {
            supabase
                .from('CRM_Usuarios')
                .select('full_name')
                .eq('id', ownerId)
                .single()
                .then(({ data }) => {
                    if (data?.full_name) {
                        setAssignedUserName(data.full_name);
                    } else {
                        setAssignedUserName(null);
                    }
                });
        } else {
            setAssignedUserName(null);
        }
    }, [account?.created_by, (account as any)?.creator_name, (account as any)?.owner_user_id, (account as any)?.owner_name]);

    // Fetch potential parents (server-side lite fetch)
    useEffect(() => {
        supabase
            .from('CRM_Cuentas')
            .select('id, nombre, nit_base')
            .is('id_cuenta_principal', null) // Only parents
            .order('nombre')
            .limit(100)
            .then(({ data }) => {
                if (data) setParents(data);
            });

    }, []);

    // Tab State
    // Tab State moved to top

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isDirty },
    } = useForm<AccountFormData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            nombre: account?.nombre || "",
            nit_base: account?.nit_base || "",
            is_child: account?.id_cuenta_principal ? true : false,
            id_cuenta_principal: account?.id_cuenta_principal || "",
            canal_id: account?.canal_id || "DIST_NAC",
            subclasificacion_id: (account?.subclasificacion_id !== undefined && account?.subclasificacion_id !== null) ? String(account.subclasificacion_id) : "",
            telefono: account?.telefono || "",
            email: (account as any)?.email || "",
            direccion: account?.direccion || "",
            departamento_id: account?.departamento_id ? String(account.departamento_id) : "",
            ciudad_id: account?.ciudad_id ? String(account.ciudad_id) : "",
            ciudad: account?.ciudad || "",
            es_premium: account?.es_premium || false,
            nivel_premium: account?.nivel_premium || null
        }
    });

    // Update form when account changes (ONLY if not modified by user to avoid overwriting)
    useEffect(() => {
        if (account && !isDirty) {
            console.log('[AccountForm] DEBUG - Syncing form with fresh account data (not dirty)');
            reset({
                nombre: account.nombre || "",
                nit_base: account.nit_base || "",
                is_child: account.id_cuenta_principal ? true : false,
                id_cuenta_principal: account.id_cuenta_principal || "",
                canal_id: account.canal_id || "DIST_NAC",
                subclasificacion_id: (account.subclasificacion_id !== undefined && account.subclasificacion_id !== null) ? String(account.subclasificacion_id) : "",
                telefono: account.telefono || "",
                email: (account as any)?.email || "",
                direccion: account.direccion || "",
                departamento_id: account.departamento_id ? String(account.departamento_id) : "",
                ciudad_id: account.ciudad_id ? String(account.ciudad_id) : "",
                ciudad: account.ciudad || "",
                es_premium: account.es_premium || false,
                nivel_premium: account.nivel_premium || null
            }, { keepDefaultValues: true });
        }
    }, [account, reset, isDirty]);

    const isChild = watch("is_child");
    const selectedParentId = watch("id_cuenta_principal");
    const selectedChannel = watch("canal_id");

    // Reset subclasificacion when channel changes (ONLY if it's a manual change, not initial load)
    const [lastProcessedChannel, setLastProcessedChannel] = useState<string | null>(account?.canal_id || null);

    useEffect(() => {
        // If channel changed manually
        if (selectedChannel && lastProcessedChannel && selectedChannel !== lastProcessedChannel) {
            const currentSubId = watch("subclasificacion_id");

            // CRITICAL: Only validate if we actually have options loaded. 
            // If they are empty, it might be a sync delay, so we WAIT.
            if (currentSubId && subclassifications.length > 0) {
                const isValidForChannel = subclassifications.some(
                    sub => sub.canal_id === selectedChannel && String(sub.id) === currentSubId
                );

                if (!isValidForChannel) {
                    console.log('[AccountForm] DEBUG - Resetting subclasificacion_id because channel changed and current is invalid');
                    setValue("subclasificacion_id", "", { shouldDirty: true });
                }
            } else if (currentSubId && displaySubclassifications.length > 0) {
                // Secondary check with fallback data if local sync is pending
                const isValidInFallback = displaySubclassifications.some(
                    sub => sub.canal_id === selectedChannel && String(sub.id) === currentSubId
                );
                if (!isValidInFallback) {
                    setValue("subclasificacion_id", "", { shouldDirty: true });
                }
            }
            setLastProcessedChannel(selectedChannel);
        } else if (selectedChannel && !lastProcessedChannel) {
            setLastProcessedChannel(selectedChannel);
        }
    }, [selectedChannel, lastProcessedChannel, subclassifications, displaySubclassifications, setValue, watch]);

    // Filter possible parents (exclude self)
    const potentialParents = parents.filter(p => p.id !== account?.id);

    const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const parentId = e.target.value;
        const parent = parents.find(a => a.id === parentId);
        if (parent) {
            setValue("nit_base", parent.nit_base || "");
        }
    };

    const [nitError, setNitError] = useState<string | null>(null);

    const onSubmit = async (data: AccountFormData) => {
        setIsSubmitting(true);
        setNitError(null);
        try {
            const formData = data;

            // PRE-VALIDATION: Check for duplicates (Name, NIT, Phone, Email)
            // Only checks against SERVER (Supabase) to ensure global uniqueness.
            // Excludes current account ID if editing.

            const checkDuplicates = async () => {
                let query = supabase
                    .from('CRM_Cuentas')
                    .select('id, nombre, nit_base, telefono, email')
                    .or(`nombre.eq.${formData.nombre},nit_base.eq.${formData.nit_base}${formData.telefono ? `,telefono.eq.${formData.telefono}` : ''}${formData.email ? `,email.eq.${formData.email}` : ''}`);

                if (account?.id) {
                    query = query.neq('id', account.id);
                }

                // If it's a child account, we might be less strict about NIT (inherits), 
                // but NAME should still be unique presumably? 
                // The requirement says "duplicates in: Account Name, NIT, Phone, Email".
                // We'll apply it broadly.

                const { data: duplicates, error: checkError } = await query;

                if (checkError) {
                    console.error("Error checking duplicates:", checkError);
                    // Decide if we block or proceed cautiously. Ideally block or warn?
                    // Let's not block completely on network error, or alert user?
                    // For now, allow proceed but log.
                    return null;
                }
                return duplicates;
            };

            const duplicates = await checkDuplicates();

            if (duplicates && duplicates.length > 0) {
                // Find specific conflicts
                const nameConflict = duplicates.find(d => d.nombre.toLowerCase() === formData.nombre.toLowerCase());
                const nitConflict = duplicates.find(d => d.nit_base === formData.nit_base);
                const phoneConflict = formData.telefono ? duplicates.find(d => d.telefono === formData.telefono) : null;
                const emailConflict = formData.email ? duplicates.find(d => d.email === formData.email) : null;

                let errorMessage = "";
                if (nameConflict) errorMessage += `\n- El nombre "${formData.nombre}" ya existe.`;
                if (nitConflict && (!formData.is_child)) errorMessage += `\n- El NIT "${formData.nit_base}" ya existe.`; // Allow duplicate NIT for child accounts? Form logic below handles inheritance, but requirement says "NIT". Usually branches share NIT. If is_child, we skip NIT check or let it pass? Code below sets NIT from parent. Let's strictly block invalid NIT usage for PARENTS.
                if (phoneConflict) errorMessage += `\n- El teléfono "${formData.telefono}" ya existe.`;
                if (emailConflict) errorMessage += `\n- El email "${formData.email}" ya existe.`;

                if (errorMessage) {
                    alert(`No se puede guardar. Se encontraron registros duplicados:${errorMessage}`);
                    setIsSubmitting(false);
                    return;
                }
            }

            if (formData.is_child && formData.id_cuenta_principal) {
                const parent = parents.find(a => a.id === formData.id_cuenta_principal);
                if (parent) formData.nit_base = parent.nit_base || "";
            }

            const payload: any = {
                nombre: data.nombre,
                nit_base: data.nit_base,
                id_cuenta_principal: data.is_child ? data.id_cuenta_principal : null,
                canal_id: data.canal_id,
                subclasificacion_id: data.subclasificacion_id ? Number(data.subclasificacion_id) : null,
                telefono: data.telefono || null,
                email: data.email || null,
                direccion: data.direccion || null,
                departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
                ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null,
                ciudad: data.ciudad_id ? citiesList.find(c => String(c.id) === data.ciudad_id)?.nombre : (data.ciudad || null),
                es_premium: !!data.nivel_premium,
                nivel_premium: data.nivel_premium || null
            };

            // DEBUG: Log the final payload
            console.log('--- SUBMITTING ACCOUNT PAYLOAD ---');
            console.table(payload);
            console.log('---------------------------------');

            if (account?.id) {
                console.log('[AccountForm] DEBUG - Calling updateAccount with id:', account.id);
                await updateAccount(account.id, payload);
            } else {
                await createAccount(payload);
            }

            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error guardando cuenta");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg dark:bg-slate-900">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-200 dark:border-slate-800 mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info'
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <Building2 size={16} />
                    Información General
                </button>

                {account?.id && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('contacts')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'contacts'
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        <User size={16} />
                        Contactos
                    </button>
                )}

                {account?.id && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('opportunities')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'opportunities'
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        <Briefcase size={16} />
                        Oportunidades
                    </button>
                )}

                {account?.id && (userRole === 'ADMIN' || userRole === 'COORDINADOR') && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('assigned')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'assigned'
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        <User size={16} />
                        Asignado
                    </button>
                )}
            </div>

            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit((data) => onSubmit(data as AccountFormData))} className="space-y-4 p-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nombre */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nombre de Cuenta</label>
                            <input {...register("nombre")} className="w-full border p-2 rounded" placeholder="Ej. Constructora XYZ" />
                            {errors.nombre && <span className="text-red-500 text-xs">{errors.nombre.message}</span>}
                        </div>

                        {/* Hierarchy Switch */}
                        <div className="flex items-center space-x-2 pt-6">
                            <input
                                type="checkbox"
                                id="is_child"
                                {...register("is_child")}
                                className="w-4 h-4"
                            />
                            <label htmlFor="is_child" className="text-sm cursor-pointer select-none">
                                Es cuenta hija / sucursal
                            </label>
                        </div>

                        {/* Premium Tiers (Medals) */}
                        <div className="pt-6">
                            <label className="text-sm font-bold text-slate-700 block mb-2">
                                Nivel de Cliente (Premium)
                            </label>

                            <div className="flex gap-3">
                                {/* ORO */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = watch("nivel_premium");
                                        const newVal = current === 'ORO' ? null : 'ORO';
                                        setValue("nivel_premium", newVal);
                                        setValue("es_premium", !!newVal);
                                    }}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                        watch("nivel_premium") === 'ORO'
                                            ? "bg-amber-50 border-amber-400 text-amber-700 shadow-sm"
                                            : "bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:text-amber-600/70"
                                    )}
                                >
                                    <Medal className={cn("w-6 h-6 mb-1", watch("nivel_premium") === 'ORO' ? "fill-amber-400 text-amber-500" : "fill-none")} />
                                    <span className="text-xs font-bold">ORO</span>
                                </button>

                                {/* PLATA */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = watch("nivel_premium");
                                        const newVal = current === 'PLATA' ? null : 'PLATA';
                                        setValue("nivel_premium", newVal);
                                        setValue("es_premium", !!newVal);
                                    }}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                        watch("nivel_premium") === 'PLATA'
                                            ? "bg-slate-100 border-slate-400 text-slate-700 shadow-sm"
                                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600/70"
                                    )}
                                >
                                    <Medal className={cn("w-6 h-6 mb-1", watch("nivel_premium") === 'PLATA' ? "fill-slate-300 text-slate-500" : "fill-none")} />
                                    <span className="text-xs font-bold">PLATA</span>
                                </button>

                                {/* BRONCE */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = watch("nivel_premium");
                                        const newVal = current === 'BRONCE' ? null : 'BRONCE';
                                        setValue("nivel_premium", newVal);
                                        setValue("es_premium", !!newVal);
                                    }}
                                    className={cn(
                                        "flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                        watch("nivel_premium") === 'BRONCE'
                                            ? "bg-orange-50 border-orange-400 text-orange-700 shadow-sm"
                                            : "bg-white border-slate-100 text-slate-400 hover:border-orange-200 hover:text-orange-600/70"
                                    )}
                                >
                                    <Medal className={cn("w-6 h-6 mb-1", watch("nivel_premium") === 'BRONCE' ? "fill-orange-400 text-orange-600" : "fill-none")} />
                                    <span className="text-xs font-bold">BRONCE</span>
                                </button>
                            </div>

                            {/* Hidden field for es_premium compatibility */}
                            <input type="hidden" {...register("es_premium")} />
                        </div>
                    </div>

                    {/* Sales Channel Selector (NEW) */}
                    <div className="space-y-1 bg-slate-50 p-4 rounded border border-slate-200">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                            Canal de Venta <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-2">Define las listas de precios y fases de oportunidad disponibles.</p>
                        <select
                            {...register("canal_id")}
                            className="w-full border p-2 rounded bg-white font-medium text-slate-900 border-slate-300 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="OBRAS_NAC">Obras Nacional</option>
                            <option value="OBRAS_INT">Obras Internacional</option>
                            <option value="DIST_NAC">Distribución Nacional (Default)</option>
                            <option value="DIST_INT">Distribución Internacional</option>
                            <option value="PROPIO">Canal Propio</option>
                        </select>
                        {errors.canal_id && <span className="text-red-500 text-xs">{errors.canal_id.message}</span>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Subclasificación</label>
                        <select
                            key={`sub-${displaySubclassifications.length}-${selectedChannel}`}
                            {...register("subclasificacion_id")}
                            className="w-full border p-2 rounded bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            disabled={!selectedChannel}
                        >
                            <option value="">Seleccione...</option>
                            {displaySubclassifications.length > 0 ? (
                                displaySubclassifications
                                    .filter(sub => sub.canal_id === selectedChannel)
                                    .map(sub => (
                                        <option key={sub.id} value={String(sub.id)}>
                                            {sub.nombre}
                                        </option>
                                    ))
                            ) : (
                                <option disabled>Cargando opciones...</option>
                            )}
                        </select>
                        <p className="text-xs text-slate-500">Opciones disponibles según el canal seleccionado.</p>
                    </div>

                    {isChild ? (
                        <div className="space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="text-sm font-medium text-blue-700">Cuenta Principal (Padre)</label>
                            <select
                                {...register("id_cuenta_principal")}
                                onChange={handleParentChange}
                                className="w-full border p-2 rounded bg-white"
                            >
                                <option value="">Seleccione...</option>
                                {potentialParents.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre} ({p.nit})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">
                                Heredará el NIT base: {selectedParentId ? parents.find(a => a.id === selectedParentId)?.nit_base : "..."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-sm font-medium">NIT (Sin dígito de verificación)</label>
                            <input
                                {...register("nit_base")}
                                className={cn("w-full border p-2 rounded", nitError ? "border-red-500 bg-red-50" : "border-slate-200")}
                                placeholder="Ej. 890900123"
                                onChange={(e) => {
                                    register("nit_base").onChange(e);
                                    if (nitError) setNitError(null);
                                }}
                            />
                            {errors.nit_base && <span className="text-red-500 text-xs">{errors.nit_base.message}</span>}
                            {nitError && <div className="text-red-600 text-xs font-bold mt-1 bg-red-50 p-2 rounded border border-red-100">{nitError}</div>}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Departamento</label>
                            <select
                                key={`dep-${displayDepartments.length}-${account?.id || 'new'}`}
                                {...register("departamento_id")}
                                className="w-full border p-2 rounded bg-white"
                                onChange={(e) => {
                                    register("departamento_id").onChange(e);
                                    setValue("ciudad_id", "");
                                }}
                            >
                                <option value="">Seleccione Departamento...</option>
                                {displayDepartments.map(dep => (
                                    <option key={dep.id} value={String(dep.id)}>{dep.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Ciudad</label>
                            <select
                                key={`city-${displayCities.length}-${watch("departamento_id")}-${account?.id || 'new'}`}
                                {...register("ciudad_id")}
                                className="w-full border p-2 rounded bg-white disabled:bg-slate-50"
                                disabled={!watch("departamento_id")}
                            >
                                <option value="">Seleccione Ciudad...</option>
                                {displayCities
                                    .filter(c => String(c.departamento_id) === watch("departamento_id"))
                                    .map(city => (
                                        <option key={city.id} value={String(city.id)}>{city.nombre}</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Teléfono</label>
                            <input {...register("telefono")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Dirección</label>
                            <input {...register("direccion")} className="w-full border p-2 rounded" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Email</label>
                            <input {...register("email")} type="email" className="w-full border p-2 rounded" placeholder="correo@ejemplo.com" />
                            {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
                        </div>
                    </div>

                    {assignedUserName && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-full border border-slate-200 shadow-sm text-blue-600">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Vendedor Asignado</p>
                                <p className="text-sm font-bold text-slate-700 mt-1">{assignedUserName}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Guardar Cuenta
                        </button>
                    </div>

                </form>
            ) : activeTab === 'contacts' ? (
                <div className="p-4">
                    {account?.id && <AccountContactsTab accountId={account.id} />}
                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">
                            Cerrar
                        </button>
                    </div>
                </div>
            ) : activeTab === 'assigned' ? (
                <div className="p-4">
                    {account?.id && <AccountAssignedTab accountId={account.id} currentOwnerId={(account as any).owner_user_id || account.created_by || null} />}
                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">
                            Cerrar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4">
                    {account?.id && <AccountOpportunitiesTab accountId={account.id} />}
                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
