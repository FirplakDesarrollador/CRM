
import { useContacts } from "@/lib/hooks/useContacts";
import { db, LocalContact } from "@/lib/db";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ContactImportButton } from "./ContactImportButton";
import { ParsedContact } from "@/lib/vcard";

interface ContactFormProps {
    accountId: string;
    existingContact?: LocalContact;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ContactForm({ accountId, existingContact, onSuccess, onCancel }: ContactFormProps) {
    const { createContact, updateContact, contacts } = useContacts(accountId);

    // Initialize default values based on existingContact
    const defaultValues: Partial<LocalContact> = existingContact ? {
        nombre: existingContact.nombre,
        cargo: existingContact.cargo || "",
        email: existingContact.email || "",
        telefono: existingContact.telefono || "",
        es_principal: existingContact.es_principal || false
    } : {
        es_principal: false
    };

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<LocalContact>({
        defaultValues
    });

    const handleImport = (imported: ParsedContact) => {
        // Deduplication Check
        const isDuplicate = contacts?.some(c =>
            (imported.email && c.email?.toLowerCase() === imported.email.toLowerCase()) ||
            (imported.tel && c.telefono === imported.tel)
        );

        if (isDuplicate) {
            const proceed = window.confirm("Ya existe un contacto con este email o teléfono en esta cuenta. ¿Deseas importarlo de todos modos?");
            if (!proceed) return;
        }

        if (imported.name) setValue("nombre", imported.name);
        if (imported.title) setValue("cargo", imported.title);
        if (imported.email) setValue("email", imported.email);
        if (imported.tel) setValue("telefono", imported.tel);
        if (imported.org) {
            // We don't have an explicit 'Company' field in LocalContact visible in this form usually, 
            // but if we did, we would set it. 
            // For now, let's append it to notes or ignore if not present in form.
            // LocalContact doesn't seem to have 'notes' or 'organization' in the interface shown in creating/editing.
        }
    };

    // Clean reset when switching between add/edit or changing contacts
    useEffect(() => {
        if (existingContact) {
            reset({
                nombre: existingContact.nombre,
                cargo: existingContact.cargo || "",
                email: existingContact.email || "",
                telefono: existingContact.telefono || "",
                es_principal: existingContact.es_principal || false
            });
        } else {
            reset({
                nombre: "",
                cargo: "",
                email: "",
                telefono: "",
                es_principal: false
            });
        }
    }, [existingContact, reset]);

    const onSubmit = async (data: LocalContact) => {
        try {
            // Check for duplicates
            const checkDuplicates = async () => {
                // Build OR query components
                const checks = [];
                if (data.email) checks.push(`email.eq.${data.email}`);
                if (data.telefono) checks.push(`telefono.eq.${data.telefono}`);
                if (data.nombre) checks.push(`nombre.eq.${data.nombre}`); // Global name check per requirement

                if (checks.length === 0) return null;

                let query = supabase
                    .from('CRM_Contactos')
                    .select('id, nombre, email, telefono')
                    .or(checks.join(','));

                if (existingContact?.id) {
                    query = query.neq('id', existingContact.id);
                }

                const { data: duplicates, error } = await query;
                if (error) {
                    console.error("Error checking contact duplicates:", error);
                    return null;
                }
                return duplicates;
            };

            const duplicates = await checkDuplicates();

            if (duplicates && duplicates.length > 0) {
                const nameConflict = duplicates.find((d: any) => d.nombre.toLowerCase() === data.nombre.toLowerCase());
                const emailConflict = data.email ? duplicates.find((d: any) => d.email?.toLowerCase() === data.email?.toLowerCase()) : null;
                const phoneConflict = data.telefono ? duplicates.find((d: any) => d.telefono === data.telefono) : null;

                let errorMessage = "";
                if (nameConflict) errorMessage += `\n- El nombre "${data.nombre}" ya existe.`;
                if (emailConflict) errorMessage += `\n- El email "${data.email}" ya existe.`;
                if (phoneConflict) errorMessage += `\n- El teléfono "${data.telefono}" ya existe.`;

                if (errorMessage) {
                    alert(`No se puede guardar. Se encontraron contactos duplicados:${errorMessage}`);
                    return;
                }
            }

            if (existingContact) {
                await updateContact(existingContact.id, data);
            } else {
                await createContact({ ...data, account_id: accountId });
            }
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al guardar contacto");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    {existingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
                </h3>
                {!existingContact && <ContactImportButton onContactImported={handleImport} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Nombre Completo *</label>
                    <input
                        {...register("nombre", { required: "El nombre es obligatorio" })}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] transition-all outline-none font-bold text-slate-700 dark:text-slate-200"
                        placeholder="Ej. Juan Pérez"
                    />
                    {errors.nombre && <span className="text-red-500 font-bold text-[10px] uppercase ml-1 tracking-wider">{errors.nombre.message}</span>}
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Cargo / Posición</label>
                    <input
                        {...register("cargo")}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] transition-all outline-none font-bold text-slate-700 dark:text-slate-200"
                        placeholder="Ej. Gerente Comercial"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Correo Electrónico</label>
                    <input
                        type="email"
                        {...register("email")}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] transition-all outline-none font-bold text-slate-700 dark:text-slate-200"
                        placeholder="ejemplo@correo.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Teléfono Móvil</label>
                    <input
                        {...register("telefono")}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-[#254153]/5 focus:border-[#254153] transition-all outline-none font-bold text-slate-700 dark:text-slate-200"
                        placeholder="+57 300 123 4567"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                <input
                    type="checkbox"
                    id="es_principal"
                    {...register("es_principal")}
                    className="h-5 w-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                />
                <label htmlFor="es_principal" className="text-sm font-black text-emerald-800 dark:text-emerald-400 cursor-pointer">
                    Marcar como Contacto Principal de la cuenta
                </label>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-3 text-sm font-extrabold text-white bg-[#254153] border border-transparent rounded-xl hover:bg-[#1a2f3d] shadow-lg shadow-[#254153]/20 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar Contacto'}
                </button>
            </div>
        </form>
    );
}
