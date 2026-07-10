"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useContacts } from "@/lib/hooks/useContacts";
import { db, LocalContact } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { User, Phone, Mail, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/components/ui/utils";

const contactSchema = z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    cargo: z.string().optional().nullable(),
    email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
    telefono: z.string().nullable().optional(),
    es_principal: z.boolean(),
    comentarios: z.string().nullable().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

const LAST_STEP_INDEX = 2;

interface CreateContactWizardProps {
    accountId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function CreateContactWizard({ accountId, onSuccess, onCancel }: CreateContactWizardProps) {
    const { createContact } = useContacts(accountId);
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canSubmitFinalStep, setCanSubmitFinalStep] = useState(false);

    const account = useLiveQuery(() => db.accounts.get(accountId), [accountId]);

    const form = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            nombre: "",
            cargo: "",
            email: "",
            telefono: "",
            es_principal: false,
            comentarios: ""
        }
    });

    const { register, trigger, handleSubmit, formState: { errors } } = form;

    useEffect(() => {
        if (step !== LAST_STEP_INDEX) {
            setCanSubmitFinalStep(false);
            return;
        }

        setCanSubmitFinalStep(false);
        const timer = window.setTimeout(() => {
            setCanSubmitFinalStep(true);
        }, 500);

        return () => window.clearTimeout(timer);
    }, [step]);

    const handleNext = async () => {
        let fields: any[] = [];
        if (step === 0) fields = ["nombre", "cargo"];
        else if (step === 1) fields = ["email", "telefono"];

        const isStepValid = await trigger(fields as any);
        if (isStepValid) {
            setStep((prev) => Math.min(LAST_STEP_INDEX, prev + 1));
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(0, prev - 1));
    };

    const onSubmit = async (data: ContactFormData) => {
        if (step !== LAST_STEP_INDEX) {
            await handleNext();
            return;
        }

        if (!canSubmitFinalStep) {
            return;
        }

        setIsSubmitting(true);
        try {
            await createContact({
                nombre: data.nombre,
                es_principal: data.es_principal,
                cargo: data.cargo ?? undefined,
                email: data.email || undefined,
                telefono: data.telefono ?? undefined,
                comentarios: data.comentarios ?? undefined,
                account_id: accountId
            });
            onSuccess();
        } catch (error) {
            console.error("Error creating contact:", error);
            alert("Error al crear el contacto");
        } finally {
            setIsSubmitting(false);
        }
    };

    const STEP_LABELS = ["Identificación", "Contacto", "Confirmación"];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 max-w-2xl mx-auto">
            {/* Wizard Header */}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Crear Nuevo Contacto</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Asocia un nuevo contacto a la cuenta: <strong className="text-blue-600">{account?.nombre}</strong></p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center justify-between mb-8 relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                {STEP_LABELS.map((label, idx) => {
                    const isCompleted = step > idx;
                    const isActive = step === idx;
                    return (
                        <div key={label} className="flex flex-col items-center relative z-10">
                            <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all duration-300",
                                isCompleted ? "bg-blue-600 border-blue-600 text-white" :
                                isActive ? "bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50" :
                                "bg-white border-slate-200 text-slate-400"
                            )}>
                                {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                            </div>
                            <span className={cn(
                                "mt-1.5 text-[10px] font-bold uppercase tracking-wider",
                                isActive ? "text-blue-600" : "text-slate-400"
                            )}>
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <form 
                onSubmit={handleSubmit(onSubmit)} 
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const target = e.target as HTMLElement;
                        if (target.tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }
                }}
                className="space-y-4"
            >
                {/* Step 0: Identificación */}
                {step === 0 && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest block">Nombre Completo *</label>
                            <input {...register("nombre")} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-sm" placeholder="Ej. Juan Pérez" />
                            {errors.nombre && <span className="text-red-500 text-xs font-bold">{errors.nombre.message}</span>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest block">Cargo / Posición</label>
                            <input {...register("cargo")} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-sm" placeholder="Ej. Gerente de Compras" />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 mt-2">
                            <input type="checkbox" id="es_principal" {...register("es_principal")} className="h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                            <label htmlFor="es_principal" className="text-xs font-black text-emerald-800 cursor-pointer">Marcar como Contacto Principal de la cuenta</label>
                        </div>
                    </div>
                )}

                {/* Step 1: Contacto */}
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest block">Correo Electrónico</label>
                            <input {...register("email")} type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-sm" placeholder="correo@ejemplo.com" />
                            {errors.email && <span className="text-red-500 text-xs font-bold">{errors.email.message}</span>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest block">Teléfono Móvil</label>
                            <input {...register("telefono")} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-sm" placeholder="Ej. +57 300 123 4567" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest block">Comentarios</label>
                            <textarea {...register("comentarios")} rows={3} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 text-sm resize-none" placeholder="Notas sobre el contacto..." />
                        </div>
                    </div>
                )}

                {/* Step 2: Confirmación */}
                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-300 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 border-b pb-2">Resumen del Contacto</h4>
                        <div className="space-y-2 text-sm text-slate-600">
                            <p><strong>Nombre:</strong> {form.getValues("nombre")}</p>
                            <p><strong>Cargo:</strong> {form.getValues("cargo") || "No especificado"}</p>
                            <p><strong>Email:</strong> {form.getValues("email") || "No especificado"}</p>
                            <p><strong>Teléfono:</strong> {form.getValues("telefono") || "No especificado"}</p>
                            <p><strong>Principal:</strong> {form.getValues("es_principal") ? "Sí" : "No"}</p>
                            <p><strong>Vincular a Cuenta:</strong> {account?.nombre}</p>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-100 bg-white">
                    {step > 0 ? (
                        <button type="button" onClick={handleBack} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition active:scale-95 text-xs">
                            Atrás
                        </button>
                    ) : (
                        <button type="button" onClick={onCancel} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition active:scale-95 text-xs">
                            Cancelar
                        </button>
                    )}

                    {step < LAST_STEP_INDEX ? (
                        <button type="button" onClick={handleNext} className="px-5 py-2.5 bg-[#254153] hover:bg-[#1a2f3d] text-white rounded-xl font-bold transition flex items-center gap-1 active:scale-95 text-xs">
                            Siguiente <ChevronRight size={14} />
                        </button>
                    ) : (
                        <button type="submit" disabled={isSubmitting || !canSubmitFinalStep} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold transition flex items-center gap-1.5 active:scale-95 text-xs disabled:opacity-50">
                            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Crear Contacto
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
export default CreateContactWizard;
