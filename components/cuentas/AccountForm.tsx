"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState, useEffect } from "react";
import { Loader2, User, Building2 } from "lucide-react";
import { LocalCuenta } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import AccountContactsTab from "./AccountContactsTab";
import AccountOpportunitiesTab from "./AccountOpportunitiesTab";
import { Briefcase } from "lucide-react";
import { cn } from "@/components/ui/utils";

// Schema
const accountSchema = z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(5, "NIT requerido"),
    is_child: z.boolean(),
    id_cuenta_principal: z.string().nullable().optional(),
    canal_id: z.string().min(1, "Canal de venta requerido"),
    subclasificacion_id: z.string().optional().nullable(), // Form uses string, convert to number on submit
    telefono: z.string().nullable().optional(),
    direccion: z.string().nullable().optional(),
    ciudad: z.string().nullable().optional(),
    es_premium: z.boolean().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    account?: LocalCuenta; // Existing account to edit
}

export function AccountForm({ onSuccess, onCancel, account }: AccountFormProps) {
    const { createAccount, updateAccount } = useAccounts();
    const [parents, setParents] = useState<any[]>([]);
    const [subclassifications, setSubclassifications] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [assignedUserName, setAssignedUserName] = useState<string | null>(null);

    // Fetch assigned user name if exists
    useEffect(() => {
        // If it's already in the object (from server join), use it
        if ((account as any)?.creator_name) {
            setAssignedUserName((account as any).creator_name);
            return;
        }

        if (account?.created_by) {
            supabase
                .from('CRM_Usuarios')
                .select('full_name')
                .eq('id', account.created_by)
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
    }, [account?.created_by, (account as any)?.creator_name]);

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

        // Fetch Subclassifications
        supabase
            .from('CRM_Subclasificacion')
            .select('id, nombre, canal_id')
            .then(({ data }) => {
                console.log('[AccountForm] DEBUG - Fetched subclassifications:', data);
                if (data) setSubclassifications(data);
            });
    }, []);

    // Tab State
    const [activeTab, setActiveTab] = useState<'info' | 'contacts' | 'opportunities'>('info');

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<AccountFormData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            nombre: account?.nombre || "",
            nit_base: account?.nit_base || "",
            is_child: account?.id_cuenta_principal ? true : false,
            id_cuenta_principal: account?.id_cuenta_principal || "",
            canal_id: account?.canal_id || "DIST_NAC",
            subclasificacion_id: account?.subclasificacion_id ? String(account.subclasificacion_id) : "",
            telefono: account?.telefono || "",
            direccion: account?.direccion || "",
            ciudad: account?.ciudad || "",
            es_premium: account?.es_premium || false
        }
    });

    // Update form when account changes (for editing different accounts)
    useEffect(() => {
        if (account) {
            console.log('[AccountForm] DEBUG - Form reset with account:', account);
            console.log('[AccountForm] DEBUG - account.subclasificacion_id:', account.subclasificacion_id);
            console.log('[AccountForm] DEBUG - typeof account.subclasificacion_id:', typeof account.subclasificacion_id);
            reset({
                nombre: account.nombre || "",
                nit_base: account.nit_base || "",
                is_child: account.id_cuenta_principal ? true : false,
                id_cuenta_principal: account.id_cuenta_principal || "",
                canal_id: account.canal_id || "DIST_NAC",
                subclasificacion_id: account.subclasificacion_id ? String(account.subclasificacion_id) : "",
                telefono: account.telefono || "",
                direccion: account.direccion || "",
                ciudad: account.ciudad || "",
                es_premium: account.es_premium || false
            });
        }
    }, [account, reset]);

    const isChild = watch("is_child");
    const selectedParentId = watch("id_cuenta_principal");
    const selectedChannel = watch("canal_id");

    // Reset subclasificacion when channel changes (except on initial load)
    const [initialChannelLoaded, setInitialChannelLoaded] = useState(false);
    useEffect(() => {
        if (initialChannelLoaded && selectedChannel) {
            // Channel was changed by user, reset subclasificacion
            const currentSubId = watch("subclasificacion_id");
            const isValidForChannel = subclassifications.some(
                sub => sub.canal_id === selectedChannel && String(sub.id) === currentSubId
            );
            if (!isValidForChannel) {
                console.log('[AccountForm] DEBUG - Resetting subclasificacion_id because channel changed and current value is invalid');
                setValue("subclasificacion_id", "");
            }
        } else if (selectedChannel) {
            setInitialChannelLoaded(true);
        }
    }, [selectedChannel]);

    // DEBUG: Log filtered options whenever channel or subclassifications change
    useEffect(() => {
        const filteredOptions = subclassifications.filter(sub => sub.canal_id === selectedChannel);
        console.log('[AccountForm] DEBUG - selectedChannel:', selectedChannel);
        console.log('[AccountForm] DEBUG - Filtered options for channel:', filteredOptions);
    }, [selectedChannel, subclassifications]);

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

            // PRE-VALIDATION: Check for duplicate NIT if it's a new PARENT account
            if (!account?.id && !formData.is_child) {
                const { data: existing, error: checkError } = await supabase
                    .from('CRM_Cuentas')
                    .select('id, nombre')
                    .eq('nit_base', formData.nit_base)
                    .is('id_cuenta_principal', null)
                    .single();

                if (existing) {
                    setNitError(`El NIT ${formData.nit_base} ya pertenece a la cuenta: ${existing.nombre}`);
                    setIsSubmitting(false);
                    return;
                }
            }

            if (formData.is_child && formData.id_cuenta_principal) {
                const parent = parents.find(a => a.id === formData.id_cuenta_principal);
                if (parent) formData.nit_base = parent.nit_base || "";
            }

            const payload: any = {
                nombre: formData.nombre,
                nit_base: formData.nit_base,
                id_cuenta_principal: formData.is_child ? formData.id_cuenta_principal : null,
                canal_id: formData.canal_id,
                subclasificacion_id: formData.subclasificacion_id ? Number(formData.subclasificacion_id) : null,
                telefono: formData.telefono || null,
                direccion: formData.direccion || null,
                ciudad: formData.ciudad || null,
                es_premium: formData.es_premium || false
            };

            // DEBUG: Log the payload being sent
            console.log('[AccountForm] DEBUG - formData.subclasificacion_id:', formData.subclasificacion_id);
            console.log('[AccountForm] DEBUG - payload:', JSON.stringify(payload, null, 2));

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
            </div>

            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit((data) => onSubmit(data as AccountFormData))} className="space-y-4 p-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nombre */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nombre de Cuenta</label>
                            <input {...register("nombre")} className="w-full border p-2 rounded" placeholder="Ej. Constructora XYZ" />
                            {errors.nombre && <span className="text-red-500 text-xs">{errors.nombre.message}</span>}
                            {assignedUserName && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <User size={12} className="text-slate-400" />
                                    Usuario asignado: <span className="font-semibold text-slate-700">{assignedUserName}</span>
                                </p>
                            )}
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

                        {/* Premium Switch */}
                        <div className="flex items-center space-x-2 pt-6">
                            <input
                                type="checkbox"
                                id="es_premium"
                                {...register("es_premium")}
                                className="w-4 h-4"
                            />
                            <label htmlFor="es_premium" className="text-sm font-bold text-amber-600 cursor-pointer select-none flex items-center gap-1">
                                Cliente Premium
                            </label>
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
                            {...register("subclasificacion_id")}
                            className="w-full border p-2 rounded bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            disabled={!selectedChannel}
                        >
                            <option value="">Seleccione...</option>
                            {subclassifications
                                .filter(sub => sub.canal_id === selectedChannel)
                                .map(sub => (
                                    <option key={sub.id} value={String(sub.id)}>
                                        {sub.nombre}
                                    </option>
                                ))}
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium">Teléfono</label>
                            <input {...register("telefono")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Ciudad</label>
                            <input {...register("ciudad")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Dirección</label>
                            <input {...register("direccion")} className="w-full border p-2 rounded" />
                        </div>
                    </div>

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
