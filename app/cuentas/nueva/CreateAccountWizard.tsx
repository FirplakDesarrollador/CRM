"use client";

import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalCiudad, type LocalCuenta, type LocalDepartamento, type LocalPais, type LocalSubclasificacion } from "@/lib/db";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useState, useEffect } from "react";
import { Loader2, Medal, ChevronRight, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/components/ui/utils";
import { useRouter } from "next/navigation";

const accountSchema = z.object({
    nombre: z.string().min(2, "Nombre requerido"),
    nit_base: z.string().min(5, "NIT requerido"),
    is_child: z.boolean().default(false),
    id_cuenta_principal: z.string().nullable().optional(),
    canal_id: z.string().min(1, "Canal de venta requerido"),
    subclasificacion_id: z.string().optional().nullable(),
    telefono: z.string().nullable().optional(),
    email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
    direccion: z.string().nullable().optional(),
    pais_id: z.string().nullable().optional(),
    departamento_id: z.string().nullable().optional(),
    ciudad_id: z.string().nullable().optional(),
    ciudad: z.string().nullable().optional(),
    es_premium: z.boolean().optional(),
    nivel_premium: z.enum(['PREMIUM', 'DESTACADO', 'ACTIVO']).nullable().optional(),
    ignorar_limites_descuento: z.boolean().optional(),
    comentarios: z.string().nullable().optional(),
});

type AccountFormInput = z.input<typeof accountSchema>;
type AccountFormData = z.output<typeof accountSchema>;
type ParentAccount = Pick<LocalCuenta, "id" | "nombre" | "nit_base">;
type DuplicateAccount = Pick<LocalCuenta, "id" | "nombre" | "nit_base" | "telefono" | "email">;
type PremiumTier = NonNullable<AccountFormData["nivel_premium"]>;

const STEP_LABELS = ["Información Base", "Ubicación y Contacto", "Clasificación"];
const LAST_STEP_INDEX = STEP_LABELS.length - 1;
const PREMIUM_TIERS: PremiumTier[] = ["PREMIUM", "DESTACADO", "ACTIVO"];

export default function CreateAccountWizard() {
    const router = useRouter();
    const { createAccount } = useAccounts();
    const [step, setStep] = useState(0);
    const [parents, setParents] = useState<ParentAccount[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canSubmitFinalStep, setCanSubmitFinalStep] = useState(false);

    const subclassifications = useLiveQuery(() => db.subclasificaciones.toArray()) || [];
    const countriesList = useLiveQuery(() => db.countries.toArray()) || [];
    const departmentsList = useLiveQuery(() => db.departments.toArray()) || [];
    const citiesList = useLiveQuery(() => db.cities.toArray()) || [];

    const [fallbackSubclassifications, setFallbackSubclassifications] = useState<LocalSubclasificacion[]>([]);
    const [fallbackCountries, setFallbackCountries] = useState<LocalPais[]>([]);
    const [fallbackDepartments, setFallbackDepartments] = useState<LocalDepartamento[]>([]);
    const [fallbackCities, setFallbackCities] = useState<LocalCiudad[]>([]);

    useEffect(() => {
        if (subclassifications.length === 0) {
            supabase.from('CRM_Subclasificacion').select('id, nombre, canal_id').then(({ data }) => {
                if (data) setFallbackSubclassifications(data);
            });
        }
        if (countriesList.length === 0) {
            supabase.from('CRM_Paises').select('*').then(({ data }) => {
                if (data) setFallbackCountries(data);
            });
        }
        if (departmentsList.length === 0) {
            supabase.from('CRM_Departamentos').select('*').then(({ data }) => {
                if (data) setFallbackDepartments(data);
            });
        }
        if (citiesList.length === 0) {
            supabase.from('CRM_Ciudades').select('*').then(({ data }) => {
                if (data) setFallbackCities(data);
            });
        }
        supabase.from('CRM_Cuentas').select('id, nombre, nit_base').is('id_cuenta_principal', null).order('nombre').limit(100).then(({ data }) => {
            if (data) setParents(data);
        });
    }, [subclassifications.length, countriesList.length, departmentsList.length, citiesList.length]);

    const displaySubclassifications = subclassifications.length > 0 ? subclassifications : fallbackSubclassifications;
    const displayCountries = countriesList.length > 0 ? countriesList : fallbackCountries;
    const displayDepartments = departmentsList.length > 0 ? departmentsList : fallbackDepartments;
    const displayCities = citiesList.length > 0 ? citiesList : fallbackCities;

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

    const form = useForm<AccountFormInput, unknown, AccountFormData>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            nombre: "",
            nit_base: "",
            is_child: false,
            id_cuenta_principal: "",
            canal_id: "DIST_NAC",
            subclasificacion_id: "",
            telefono: "",
            email: "",
            direccion: "",
            pais_id: "1",
            departamento_id: "",
            ciudad_id: "",
            ciudad: "",
            es_premium: false,
            nivel_premium: null,
            ignorar_limites_descuento: false,
            comentarios: ""
        }
    });

    const { register, trigger, handleSubmit, watch, setValue, formState: { errors } } = form;

    const isChild = watch("is_child");
    const selectedChannel = watch("canal_id");

    const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const parentId = e.target.value;
        const parent = parents.find(a => a.id === parentId);
        if (parent) {
            setValue("nit_base", parent.nit_base || "");
        }
    };

    const handleNext = async () => {
        let fieldsToValidate: FieldPath<AccountFormInput>[] = [];
        if (step === 0) {
            fieldsToValidate = ["nombre", "canal_id"];
            if (!isChild) fieldsToValidate.push("nit_base");
            if (isChild) fieldsToValidate.push("id_cuenta_principal");
        } else if (step === 1) {
            fieldsToValidate = ["email", "telefono", "direccion"];
        }

        const isStepValid = await trigger(fieldsToValidate);
        if (isStepValid) {
            setStep((prev) => Math.min(LAST_STEP_INDEX, prev + 1));
        }
    };

    const handleBack = () => {
        setStep((prev) => Math.max(0, prev - 1));
    };

    const onSubmit = async (data: AccountFormData) => {
        if (step !== LAST_STEP_INDEX) {
            await handleNext();
            return;
        }

        if (!canSubmitFinalStep) {
            return;
        }

        setIsSubmitting(true);
        try {
            // Check duplicates against Supabase
            const checkDuplicates = async () => {
                const query = supabase
                    .from('CRM_Cuentas')
                    .select('id, nombre, nit_base, telefono, email')
                    .eq('is_deleted', false)
                    .or(`nombre.eq.${data.nombre},nit_base.eq.${data.nit_base}${data.telefono ? `,telefono.eq.${data.telefono}` : ''}${data.email ? `,email.eq.${data.email}` : ''}`);

                const { data: duplicates } = await query;
                return (duplicates ?? []) as DuplicateAccount[];
            };

            const duplicates = await checkDuplicates();
            if (duplicates && duplicates.length > 0) {
                const nameConflict = duplicates.find(d => d.nombre.toLowerCase() === data.nombre.toLowerCase());
                const nitConflict = duplicates.find(d => d.nit_base === data.nit_base);
                const phoneConflict = data.telefono ? duplicates.find(d => d.telefono === data.telefono) : null;
                const emailConflict = data.email ? duplicates.find(d => d.email === data.email) : null;

                let errorMessage = "";
                if (nameConflict) errorMessage += `\n- El nombre "${data.nombre}" ya existe.`;
                if (nitConflict && !data.is_child) errorMessage += `\n- El NIT "${data.nit_base}" ya existe.`;
                if (phoneConflict) errorMessage += `\n- El teléfono "${data.telefono}" ya existe.`;
                if (emailConflict) errorMessage += `\n- El email "${data.email}" ya existe.`;

                if (errorMessage) {
                    alert(`No se puede crear. Se encontraron registros duplicados:${errorMessage}`);
                    setIsSubmitting(false);
                    return;
                }
            }

            if (data.is_child && data.id_cuenta_principal) {
                const parent = parents.find(a => a.id === data.id_cuenta_principal);
                if (parent) data.nit_base = parent.nit_base || "";
            }

            const payload: Partial<LocalCuenta> = {
                nombre: data.nombre,
                nit_base: data.nit_base,
                id_cuenta_principal: data.is_child ? data.id_cuenta_principal : null,
                canal_id: data.canal_id,
                subclasificacion_id: data.subclasificacion_id ? Number(data.subclasificacion_id) : null,
                telefono: data.telefono || undefined,
                email: data.email || undefined,
                direccion: data.direccion || undefined,
                pais_id: data.pais_id ? Number(data.pais_id) : null,
                departamento_id: data.departamento_id ? Number(data.departamento_id) : null,
                ciudad_id: data.ciudad_id ? Number(data.ciudad_id) : null,
                ciudad: data.ciudad_id ? displayCities.find(c => String(c.id) === data.ciudad_id)?.nombre : (data.ciudad || undefined),
                es_premium: !!data.nivel_premium,
                nivel_premium: data.nivel_premium || null,
                ignorar_limites_descuento: data.ignorar_limites_descuento || false,
                comentarios: data.comentarios || undefined
            };

            const newId = await createAccount(payload);
            router.push(`/cuentas?id=${newId}`);
        } catch (error) {
            console.error("Error creating account:", error);
            alert("Error al crear la cuenta");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8">
                {/* Wizard Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Crear Nueva Cuenta</h2>
                    <p className="text-sm text-slate-500 mt-1">Completa los pasos para registrar el nuevo cliente.</p>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center justify-between mb-8 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                    {STEP_LABELS.map((label, idx) => {
                        const isCompleted = step > idx;
                        const isActive = step === idx;
                        return (
                            <div key={label} className="flex flex-col items-center relative z-10">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center border font-bold text-sm transition-all duration-300",
                                    isCompleted ? "bg-blue-600 border-blue-600 text-white" :
                                    isActive ? "bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50" :
                                    "bg-white border-slate-200 text-slate-400"
                                )}>
                                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                                </div>
                                <span className={cn(
                                    "mt-2 text-xs font-semibold uppercase tracking-wider text-center hidden md:block",
                                    isActive ? "text-blue-600 font-bold" : "text-slate-400"
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
                    className="space-y-6"
                >
                    {/* STEP 0: Información Base */}
                    {step === 0 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Nombre de Cuenta *</label>
                                <input {...register("nombre")} className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium" placeholder="Ej. Constructora Firplak SAS" />
                                {errors.nombre && <p className="text-red-500 text-xs font-bold">{errors.nombre.message}</p>}
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <input type="checkbox" id="is_child" {...register("is_child")} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                <label htmlFor="is_child" className="text-sm font-bold text-slate-600 cursor-pointer select-none">Es una sucursal / cuenta hija</label>
                            </div>

                            {isChild ? (
                                <div className="space-y-1 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                    <label className="text-sm font-bold text-blue-800 block">Cuenta Principal (Padre) *</label>
                                    <select {...register("id_cuenta_principal")} onChange={handleParentChange} className="w-full border p-3 rounded-xl bg-white border-blue-200 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Seleccione cuenta principal...</option>
                                        {parents.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} ({p.nit_base})</option>
                                        ))}
                                    </select>
                                    {errors.id_cuenta_principal && <p className="text-red-500 text-xs font-bold">{errors.id_cuenta_principal.message}</p>}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 block">NIT (Sin dígito de verificación) *</label>
                                    <input {...register("nit_base")} className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Ej. 900123456" />
                                    {errors.nit_base && <p className="text-red-500 text-xs font-bold">{errors.nit_base.message}</p>}
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Canal de Venta *</label>
                                <select {...register("canal_id")} className="w-full border p-3 rounded-xl bg-white border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                                    <option value="DIST_NAC">Distribución Nacional</option>
                                    <option value="OBRAS_NAC">Obras Nacional</option>
                                    <option value="DIST_INT">Distribución Internacional</option>
                                    <option value="OBRAS_INT">Obras Internacional</option>
                                    <option value="PROPIO">Canal Propio</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Subclasificación</label>
                                <select {...register("subclasificacion_id")} className="w-full border p-3 rounded-xl bg-white border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium" disabled={!selectedChannel}>
                                    <option value="">Seleccione subclasificación...</option>
                                    {displaySubclassifications.filter(sub => sub.canal_id === selectedChannel).map(sub => (
                                        <option key={sub.id} value={String(sub.id)}>{sub.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Contacto y Ubicación */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">País</label>
                                    <select {...register("pais_id")} className="w-full border p-3 rounded-xl bg-white border-slate-200 outline-none" onChange={(e) => {
                                        register("pais_id").onChange(e);
                                        setValue("departamento_id", "");
                                        setValue("ciudad_id", "");
                                    }}>
                                        <option value="">Seleccione País...</option>
                                        {displayCountries.map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Departamento</label>
                                    <select {...register("departamento_id")} className="w-full border p-3 rounded-xl bg-white border-slate-200 outline-none disabled:opacity-50" disabled={!watch("pais_id")} onChange={(e) => {
                                        register("departamento_id").onChange(e);
                                        setValue("ciudad_id", "");
                                    }}>
                                        <option value="">Seleccione Departamento...</option>
                                        {displayDepartments.filter(dep => String(dep.pais_id) === watch("pais_id") || (!dep.pais_id && watch("pais_id") === "1")).map(dep => (
                                            <option key={dep.id} value={String(dep.id)}>{dep.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-700 block mb-1">Ciudad</label>
                                    <select {...register("ciudad_id")} className="w-full border p-3 rounded-xl bg-white border-slate-200 outline-none disabled:opacity-50" disabled={!watch("departamento_id")}>
                                        <option value="">Seleccione Ciudad...</option>
                                        {displayCities.filter(c => String(c.departamento_id) === watch("departamento_id")).map(city => (
                                            <option key={city.id} value={String(city.id)}>{city.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 block">Teléfono</label>
                                    <input {...register("telefono")} className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej. +57 300 123 4567" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-slate-700 block">Correo Electrónico</label>
                                    <input {...register("email")} type="email" className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="correo@ejemplo.com" />
                                    {errors.email && <p className="text-red-500 text-xs font-bold">{errors.email.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Dirección Física</label>
                                <input {...register("direccion")} className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Calle 123 # 45 - 67" />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Clasificación y Comentarios */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div>
                                <label className="text-sm font-bold text-slate-700 block mb-3">Nivel de Cliente (Premium)</label>
                                <div className="flex gap-4">
                                    {PREMIUM_TIERS.map((tier) => {
                                        const label = tier === 'PREMIUM' ? 'Premium' : tier === 'DESTACADO' ? 'Destacado' : 'Activo';
                                        const currentTier = watch("nivel_premium");
                                        const isSelected = currentTier === tier;
                                        return (
                                            <button
                                                key={tier}
                                                type="button"
                                                onClick={() => {
                                                    const newVal: AccountFormData["nivel_premium"] = isSelected ? null : tier;
                                                    setValue("nivel_premium", newVal);
                                                    setValue("es_premium", !!newVal);
                                                }}
                                                className={cn(
                                                    "flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all font-bold",
                                                    isSelected ? "bg-blue-50 border-blue-500 text-blue-700 shadow-md" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                                )}
                                            >
                                                <Medal className={cn("w-6 h-6 mb-1", isSelected ? "text-blue-500 fill-blue-100" : "text-slate-300")} />
                                                <span className="text-xs uppercase">{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700 block">Comentarios Iniciales</label>
                                <textarea {...register("comentarios")} rows={4} className="w-full border p-3 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Ingresa notas iniciales sobre el cliente..." />
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center pt-6 border-t border-slate-100 bg-white">
                        {step > 0 ? (
                            <button type="button" onClick={handleBack} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition active:scale-95">
                                Atrás
                            </button>
                        ) : (
                            <button type="button" onClick={() => router.push("/cuentas")} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition active:scale-95">
                                Cancelar
                            </button>
                        )}

                        {step < LAST_STEP_INDEX ? (
                            <button type="button" onClick={handleNext} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-1.5 active:scale-95 shadow-md shadow-blue-200">
                                Siguiente <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button type="submit" disabled={isSubmitting || !canSubmitFinalStep} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-extrabold hover:bg-blue-700 transition flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-50">
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Crear Cuenta
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
