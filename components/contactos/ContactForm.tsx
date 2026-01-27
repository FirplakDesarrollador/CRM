
import { useContacts } from "@/lib/hooks/useContacts";
import { LocalContact } from "@/lib/db";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg bg-white dark:bg-slate-900 border-blue-100 dark:border-slate-800">
            <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {existingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
                </h3>
                {!existingContact && <ContactImportButton onContactImported={handleImport} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
                    <input
                        {...register("nombre", { required: "El nombre es obligatorio" })}
                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej. Juan Pérez"
                    />
                    {errors.nombre && <span className="text-red-500 text-xs">{errors.nombre.message}</span>}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cargo</label>
                    <input
                        {...register("cargo")}
                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej. Gerente Comercial"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
                    <input
                        type="email"
                        {...register("email")}
                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="ejemplo@correo.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Teléfono</label>
                    <input
                        {...register("telefono")}
                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="+57 300 123 4567"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 py-2">
                <input
                    type="checkbox"
                    id="es_principal"
                    {...register("es_principal")}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="es_principal" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Es Contacto Principal
                </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 dark:hover:bg-slate-700"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar Contacto'}
                </button>
            </div>
        </form>
    );
}
