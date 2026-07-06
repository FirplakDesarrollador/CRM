"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { X, CalendarPlus } from "lucide-react";

interface CreateStoreActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ActivityFormData {
    fecha_inicio: string;
    fecha_fin: string;
}

export function CreateStoreActivityModal({ isOpen, onClose }: CreateStoreActivityModalProps) {
    const { register, handleSubmit, reset } = useForm<ActivityFormData>();

    if (!isOpen) return null;

    const onSubmit = (data: ActivityFormData) => {
        // Por ahora solo mostramos en consola hasta que se definan los demás campos
        console.log("Datos de la actividad:", data);
        alert("Actividad temporalmente guardada en consola. Faltan los demás campos.");
        onClose();
        reset();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Crear Actividad</h2>
                        <p className="text-sm text-slate-500">Programa una nueva actividad para la tienda.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <form id="store-activity-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        
                        <div className="flex items-center gap-2 mb-4 text-orange-600 font-semibold border-b pb-2">
                            <CalendarPlus className="w-5 h-5" /> Fechas de la Actividad
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700">Fecha y Hora Inicial</label>
                            <input 
                                type="datetime-local" 
                                {...register("fecha_inicio", { required: true })} 
                                className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" 
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700">Fecha y Hora Final</label>
                            <input 
                                type="datetime-local" 
                                {...register("fecha_fin", { required: true })} 
                                className="w-full mt-1 border p-2 rounded-lg border-slate-300 focus:ring-2 focus:ring-orange-500 outline-none" 
                            />
                        </div>

                    </form>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        form="store-activity-form"
                        className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg flex items-center transition-colors shadow-sm"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}
