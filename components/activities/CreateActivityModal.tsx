"use client";

import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { CalendarClock, ListTodo } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { toInputDate, toInputDateTime, parseColombiaDate } from "@/lib/date-utils";

interface CreateActivityModalProps {
    onClose: () => void;
    onSubmit: (data: any) => void;
    opportunities?: any[];
    initialOpportunityId?: string;
    initialData?: any;
}

// Helper removed in favor of @/lib/date-utils

export function CreateActivityModal({ onClose, onSubmit, opportunities, initialOpportunityId, initialData }: CreateActivityModalProps) {
    const isEditing = !!initialData;

    const { register, handleSubmit, watch, setValue } = useForm({
        defaultValues: {
            asunto: initialData?.asunto || '',
            descripcion: initialData?.descripcion || '',
            tipo_actividad: (initialData?.tipo_actividad || 'EVENTO') as 'TAREA' | 'EVENTO',
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

    const tipo = watch('tipo_actividad');
    const fechaInicio = watch('fecha_inicio');

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

                <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain pb-6">
                    {/* Activity Type Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setValue('tipo_actividad', 'EVENTO')}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all",
                                tipo === 'EVENTO' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <CalendarClock className="w-4 h-4" /> Evento / Cita
                        </button>
                        <button
                            type="button"
                            onClick={() => setValue('tipo_actividad', 'TAREA')}
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

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Asunto</label>
                        <input
                            {...register('asunto', { required: true })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder={tipo === 'TAREA' ? "Ej. Llamar a seguimiento" : "Ej. Reunión de presentación"}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                {tipo === 'TAREA' ? 'Fecha Vencimiento' : 'Fecha Inicio'}
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
                            type="button"
                            onClick={handleSubmit((data) => {
                                // Ensure dates are unambiguous ISO with Z (UTC) for storage
                                const processed = { ...data };

                                // VALIDATION: Check for past dates
                                const todayDate = new Date();
                                const todayISO = toInputDate(todayDate);
                                const selectedISO = data.fecha_inicio ? data.fecha_inicio.slice(0, 10) : "";

                                if (selectedISO && selectedISO < todayISO) {
                                    // If strictly before today, allow ONLY if it matches the initial value (preserving existing past records)
                                    const initialISO = initialData?.fecha_inicio
                                        ? toInputDate(initialData.fecha_inicio)
                                        : "";

                                    if (!isEditing || selectedISO !== initialISO) {
                                        alert("No se puede programar una actividad para una fecha anterior a hoy.");
                                        return;
                                    }
                                }

                                if (data.fecha_inicio) {
                                    processed.fecha_inicio = new Date(data.fecha_inicio).toISOString();
                                }

                                if (data.fecha_fin) {
                                    const selectedEndDate = new Date(data.fecha_fin);
                                    processed.fecha_fin = selectedEndDate.toISOString();
                                }

                                onSubmit(processed);
                            })}
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
