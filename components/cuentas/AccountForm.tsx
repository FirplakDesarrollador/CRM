"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { LocalCuenta } from "@/lib/db";
import AccountContactsTab from "./AccountContactsTab";
import { User, Building2 } from "lucide-react";

// Schema
const accountSchema = z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(5, "NIT requerido"),
    is_child: z.boolean().default(false),
    id_cuenta_principal: z.string().nullable().optional(),
    telefono: z.string().nullable().optional(),
    direccion: z.string().nullable().optional(),
    ciudad: z.string().nullable().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    account?: LocalCuenta; // Existing account to edit
}

export function AccountForm({ onSuccess, onCancel, account }: AccountFormProps) {
    const { createAccount, updateAccount, accounts } = useAccounts();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState<'info' | 'contacts'>('info');

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<any>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            nombre: account?.nombre || "",
            nit_base: account?.nit_base || "",
            is_child: !!account?.id_cuenta_principal,
            id_cuenta_principal: account?.id_cuenta_principal || "",
            telefono: account?.telefono || "",
            direccion: account?.direccion || "",
            ciudad: account?.ciudad || ""
        }
    });

    // Update form when account changes (for editing different accounts)
    useEffect(() => {
        if (account) {
            reset({
                nombre: account.nombre || "",
                nit_base: account.nit_base || "",
                is_child: !!account.id_cuenta_principal,
                id_cuenta_principal: account.id_cuenta_principal || "",
                telefono: account.telefono || "",
                direccion: account.direccion || "",
                ciudad: account.ciudad || ""
            });
        }
    }, [account, reset]);

    const isChild = watch("is_child");
    const selectedParentId = watch("id_cuenta_principal");

    // Filter possible parents
    const potentialParents = accounts.filter(a => !a.id_cuenta_principal && a.id !== account?.id);

    const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const parentId = e.target.value;
        const parent = accounts.find(a => a.id === parentId);
        if (parent) {
            setValue("nit_base", parent.nit_base || "");
        }
    };

    const onSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            const formData = data as AccountFormData;
            if (formData.is_child && formData.id_cuenta_principal) {
                const parent = accounts.find(a => a.id === formData.id_cuenta_principal);
                if (parent) formData.nit_base = parent.nit_base || "";
            }

            const payload: any = {
                nombre: formData.nombre,
                nit_base: formData.nit_base,
                id_cuenta_principal: formData.is_child ? formData.id_cuenta_principal : null,
                telefono: formData.telefono || null,
                direccion: formData.direccion || null,
                ciudad: formData.ciudad || null
            };

            if (account?.id) {
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
            </div>

            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nombre */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nombre de Cuenta</label>
                            <input {...register("nombre")} className="w-full border p-2 rounded" placeholder="Ej. Constructora XYZ" />
                            {errors.nombre && <span className="text-red-500 text-xs">{(errors.nombre as any).message}</span>}
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
                                Heredará el NIT base: {selectedParentId ? accounts.find(a => a.id === selectedParentId)?.nit_base : "..."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-sm font-medium">NIT (Sin dígito de verificación)</label>
                            <input {...register("nit_base")} className="w-full border p-2 rounded" placeholder="Ej. 890900123" />
                            {errors.nit_base && <span className="text-red-500 text-xs">{(errors.nit_base as any).message}</span>}
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
            ) : (
                <div className="p-4">
                    {account?.id && <AccountContactsTab accountId={account.id} />}
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
