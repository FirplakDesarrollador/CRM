"use client";

import { useForm } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { CalendarClock, ListTodo, Loader2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { cn } from "@/components/ui/utils";
import { toInputDate, toInputDateTime } from "@/lib/date-utils";
import { db, LocalActivityClassification, LocalActivitySubclassification } from "@/lib/db";
import { syncEngine } from "@/lib/sync";

interface CreateActivityModalProps {
    onClose: () => void;
    onSubmit: (data: any) => void;
    opportunities?: any[];
    initialOpportunityId?: string;
    initialData?: any;
}

export function CreateActivityModal({ onClose, onSubmit, opportunities, initialOpportunityId, initialData }: CreateActivityModalProps) {
    const isEditing = !!initialData;

    // Load Catalogs
    const classifications = useLiveQuery(() => db.activityClassifications.toArray(), []) || [];
    const subclassifications = useLiveQuery(() => db.activitySubclassifications.toArray(), []) || [];

    // PROACTIVE SYNC: If catalogs are empty, trigger a pull
    useEffect(() => {
        if (classifications.length === 0 && navigator.onLine) {
            console.log("[CreateActivityModal] Catalogs empty, triggering sync...");
            syncEngine.triggerSync();
        }
    }, [classifications.length]);

    // DEBUG: Log initialData to diagnose classification issue
    console.log("[CreateActivityModal] initialData received:", initialData);
    console.log("[CreateActivityModal] clasificacion_id:", initialData?.clasificacion_id, "type:", typeof initialData?.clasificacion_id);
    console.log("[CreateActivityModal] Available classifications:", classifications.length);

    const { register, handleSubmit, watch, setValue, reset } = useForm({
        defaultValues: {
            asunto: initialData?.asunto || '',
            descripcion: initialData?.descripcion || '',
            tipo_actividad: (initialData?.tipo_actividad || 'EVENTO') as 'TAREA' | 'EVENTO',
            clasificacion_id: initialData?.clasificacion_id ? String(initialData.clasificacion_id) : "",
            subclasificacion_id: initialData?.subclasificacion_id ? String(initialData.subclasificacion_id) : "",
            fecha_inicio: initialData?.fecha_inicio
                ? (initialData.tipo_actividad === 'TAREA' ? toInputDate(initialData.fecha_inicio) : toInputDateTime(initialData.fecha_inicio))
                : (initialData?.tipo_actividad === 'TAREA' ? toInputDate(new Date()) : toInputDateTime(new Date())),
            fecha_fin: initialData?.fecha_fin
                ? toInputDateTime(initialData.fecha_fin)
                : toInputDateTime(new Date(Date.now() + 3600000)),
            opportunity_id: initialData?.opportunity_id || initialOpportunityId || '',
            is_completed: !!initialData?.is_completed
        }
    });

    // Force form reset when initialData changes OR when classifications finish loading
    // This fixes the timing issue where the select options don't exist yet when form resets
    useEffect(() => {
        if (initialData && classifications.length > 0) {
            console.log("[CreateActivityModal] Resetting form with classifications loaded:", classifications.length);
            reset({
                asunto: initialData.asunto || '',
                descripcion: initialData.descripcion || '',
                tipo_actividad: (initialData.tipo_actividad || 'EVENTO') as 'TAREA' | 'EVENTO',
                clasificacion_id: initialData.clasificacion_id ? String(initialData.clasificacion_id) : "",
                subclasificacion_id: initialData.subclasificacion_id ? String(initialData.subclasificacion_id) : "",
                fecha_inicio: initialData.fecha_inicio
                    ? (initialData.tipo_actividad === 'TAREA' ? toInputDate(initialData.fecha_inicio) : toInputDateTime(initialData.fecha_inicio))
                    : (initialData.tipo_actividad === 'TAREA' ? toInputDate(new Date()) : toInputDateTime(new Date())),
                fecha_fin: initialData.fecha_fin
                    ? toInputDateTime(initialData.fecha_fin)
                    : toInputDateTime(new Date(Date.now() + 3600000)),
                opportunity_id: initialData.opportunity_id || initialOpportunityId || '',
                is_completed: !!initialData.is_completed
            });
        }
    }, [initialData, reset, initialOpportunityId, classifications.length]);

    const handleActualSubmit = (data: any) => {
        console.log("[CreateActivityModal] Raw Submit Data:", data);
        // Ensure numbers for IDs (or null if empty)
        const processed = { ...data };
        processed.clasificacion_id = (data.clasificacion_id && data.clasificacion_id !== "") ? Number(data.clasificacion_id) : null;
        processed.subclasificacion_id = (data.subclasificacion_id && data.subclasificacion_id !== "") ? Number(data.subclasificacion_id) : null;

        console.log("[CreateActivityModal] Processed Submit Data:", processed);
        onSubmit(processed);
    };

    const tipo = watch('tipo_actividad');
    const fechaInicio = watch('fecha_inicio');
    const selectedClasificacionId = watch('clasificacion_id');

    // Filtered Lists
    const filteredClassifications = useMemo(() => {
        console.log("[CreateActivityModal] Filtering classifications for type:", tipo);
        console.log("[CreateActivityModal] All classifications:", classifications.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo_actividad })));
        const filtered = classifications.filter(c => c.tipo_actividad === tipo);
        console.log("[CreateActivityModal] Filtered classifications:", filtered.map(c => ({ id: c.id, nombre: c.nombre })));
        console.log("[CreateActivityModal] Looking for ID:", initialData?.clasificacion_id, "Is it in filtered?", filtered.some(c => c.id === initialData?.clasificacion_id || String(c.id) === String(initialData?.clasificacion_id)));
        return filtered;
    }, [classifications, tipo, initialData?.clasificacion_id]);

    const filteredSubclassifications = useMemo(() => {
        if (!selectedClasificacionId) return [];
        return subclassifications.filter(s => s.clasificacion_id === Number(selectedClasificacionId));
    }, [subclassifications, selectedClasificacionId]);

    // Auto-set fecha_fin as 1 hour after fecha_inicio for EVENTO
    useEffect(() => {
        if (tipo === 'EVENTO' && fechaInicio) {
            try {
                const start = new Date(fechaInicio);
                if (!isNaN(start.getTime())) {
                    const end = new Date(start.getTime() + 3600000); // +1 hour

                    const formattedEnd = toInputDateTime(end);
                    setValue('fecha_fin', formattedEnd, { shouldDirty: true });
                }
            } catch (e) {
                console.error("Error setting end date", e);
            }
        }
    }, [fechaInicio, tipo, setValue]);

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh] md:max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Editar Actividad' : 'Programar Actividad'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <form
                    onSubmit={handleSubmit(handleActualSubmit, (errors) => {
                        console.error("[CreateActivityModal] Validation Errors:", errors);
                    })}
                    className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain pb-6"
                >
                    {/* Activity Type Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setValue('tipo_actividad', 'EVENTO');
                                setValue('clasificacion_id', "");
                                setValue('subclasificacion_id', "");
                            }}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
                                tipo === 'EVENTO' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <CalendarClock className="w-4 h-4" /> Evento / Cita
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setValue('tipo_actividad', 'TAREA');
                                setValue('clasificacion_id', "");
                                setValue('subclasificacion_id', "");
                            }}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
                                tipo === 'TAREA' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <ListTodo className="w-4 h-4" /> Tarea
                        </button>
                    </div>

                    {/* Completion Toggle (Only for TAREAS) */}
                    {tipo === 'TAREA' && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-0.5">
                                <label className="text-xs font-bold text-slate-900 uppercase">Tarea Finalizada</label>
                                <p className="text-[10px] text-slate-500">Marcar como completada</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('is_completed')}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    )}

                    {/* CLASSIFICATION SELECTORS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                Clasificación <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    {...register('clasificacion_id', {
                                        required: "La clasificación es obligatoria",
                                        onChange: (e) => {
                                            console.log("[CreateActivityModal] Classification Selected:", e.target.value);
                                            setValue('subclasificacion_id', "");
                                        }
                                    })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value="">{classifications.length === 0 ? 'Sincronizando...' : 'Seleccione...'}</option>
                                    {filteredClassifications.map(c => (
                                        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                                    ))}
                                    {/* If current classification is not in filtered list, show it anyway (historical data) */}
                                    {initialData?.clasificacion_id &&
                                        !filteredClassifications.some(c => String(c.id) === String(initialData.clasificacion_id)) &&
                                        classifications.find(c => String(c.id) === String(initialData.clasificacion_id)) && (
                                            <option
                                                key={initialData.clasificacion_id}
                                                value={String(initialData.clasificacion_id)}
                                                className="text-amber-600"
                                            >
                                                {classifications.find(c => String(c.id) === String(initialData.clasificacion_id))?.nombre} (otro tipo)
                                            </option>
                                        )}
                                </select>
                                {classifications.length === 0 && (
                                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Show Subclassification ONLY if the selected classification has options */}
                        {filteredSubclassifications.length > 0 && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-200">
                                <label className="text-xs font-bold text-slate-500 uppercase">
                                    Subclasificación <span className="text-red-500">*</span>
                                </label>
                                <select
                                    {...register('subclasificacion_id', { required: "La subclasificación es requerida" })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value="">Seleccione...</option>
                                    {filteredSubclassifications.map(s => (
                                        <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Asunto <span className="text-red-500">*</span></label>
                        <input
                            {...register('asunto', { required: true })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder={tipo === 'TAREA' ? "Ej. Llamar a seguimiento" : "Ej. Reunión de presentación"}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                {tipo === 'TAREA' ? 'Fecha Vencimiento' : 'Fecha Inicio'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type={tipo === 'TAREA' ? "date" : "datetime-local"}
                                {...register('fecha_inicio', { required: true })}
                                min={tipo === 'TAREA' ? toInputDate(new Date()) : toInputDateTime(new Date())}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                        {tipo === 'EVENTO' && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Fecha Fin</label>
                                <input
                                    type="datetime-local"
                                    {...register('fecha_fin')}
                                    min={fechaInicio ? fechaInicio : toInputDateTime(new Date())}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Oportunidad Relacionada</label>
                        <select
                            {...register('opportunity_id')}
                            disabled={!!initialOpportunityId}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            <option value="">Seleccione una oportunidad...</option>
                            {opportunities?.map((opp: any) => (
                                <option key={opp.id} value={opp.id}>{opp.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                        <textarea
                            {...register('descripcion')}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                            placeholder="Notas adicionales..."
                        />
                    </div>

                    <div className="flex gap-3 pt-6 mt-auto border-t border-slate-100 bg-white shrink-0 sticky bottom-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={cn(
                                "flex-1 text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-colors",
                                tipo === 'TAREA' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
                            )}
                        >
                            {isEditing
                                ? 'Guardar Cambios'
                                : (tipo === 'TAREA' ? 'Crear Tarea' : 'Agendar Evento')
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
