"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";

// Schema
const accountSchema = z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(5, "NIT requerido"),
    is_child: z.boolean().default(false),
    id_cuenta_principal: z.string().optional(),
    telefono: z.string().optional(),
    direccion: z.string().optional(),
    ciudad: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export function AccountForm({ onSuccess, onCancel }: AccountFormProps) {
    const { createAccount, accounts } = useAccounts();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter possible parents (only those that are NOT children themselves ideally, but multilevel is allowed)
    const potentialParents = accounts.filter(a => !a.id_cuenta_principal); // Simplified rule: Only 1 level depth for now? Or allow tree.

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<AccountFormData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            is_child: false
        }
    });

    const isChild = watch("is_child");
    const selectedParentId = watch("id_cuenta_principal");

    // Auto-inherit NIT when parent selected
    const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const parentId = e.target.value;
        const parent = accounts.find(a => a.id === parentId);
        if (parent) {
            setValue("nit_base", parent.nit_base || ""); // Inherit NIT Base
        }
    };

    const onSubmit = async (data: AccountFormData) => {
        setIsSubmitting(true);
        try {
            // If child, ensure nit_base matches parent (security)
            if (data.is_child && data.id_cuenta_principal) {
                const parent = accounts.find(a => a.id === data.id_cuenta_principal);
                if (parent) data.nit_base = parent.nit_base;
            }

            await createAccount({
                nombre: data.nombre,
                nit_base: data.nit_base, // Server calculates full NIT
                id_cuenta_principal: data.is_child ? data.id_cuenta_principal : null,
                telefono: data.telefono,
                direccion: data.direccion,
                ciudad: data.ciudad
            });

            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error creando cuenta");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 bg-white rounded-lg">

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
                    {errors.nit_base && <span className="text-red-500 text-xs">{errors.nit_base.message}</span>}
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
    );
}
