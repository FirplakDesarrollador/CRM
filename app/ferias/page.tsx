"use client";

import React, { useState } from 'react';
import { registrarFeria } from './actions';
import { CheckCircle2, AlertCircle, Loader2, Tent } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader'; // Wait, PageHeader was removed. Let's not use it.

export default function FeriasPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        const formData = new FormData(e.currentTarget);
        const result = await registrarFeria(formData);

        setIsLoading(false);
        if (result.success) {
            setSuccess(true);
            (e.target as HTMLFormElement).reset();
        } else {
            setError(result.error || 'Error al guardar el registro.');
        }
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-50">
            <div className="p-6 pb-0">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Tent className="w-6 h-6" /> Registro de Ferias
                </h1>
                <p className="text-slate-500 mt-1">Ingresa los datos del cliente, empresa u oportunidad contactada en la feria.</p>
            </div>

            <main className="p-6 max-w-5xl">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                    {success && (
                        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
                            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                            <div>
                                <h3 className="font-bold">¡Registro guardado exitosamente!</h3>
                                <p className="text-sm mt-1 opacity-90">Los datos han sido almacenados correctamente en el sistema.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
                            <AlertCircle className="h-6 w-6 shrink-0 text-rose-600" />
                            <div>
                                <h3 className="font-bold">Error al guardar</h3>
                                <p className="text-sm mt-1 opacity-90">{error}</p>
                                {error.includes("CRM_Ferias") && (
                                    <p className="text-xs mt-2 text-rose-700 bg-rose-100/50 p-2 rounded-lg font-mono">
                                        Nota: Asegúrate de ejecutar el script SQL en Supabase para crear la tabla 'CRM_Ferias'.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            
                            {/* Columna Izquierda */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Nombre de Cliente / Contacto <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        name="nombre_contacto"
                                        type="text"
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Teléfono <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        name="telefono"
                                        type="tel"
                                        placeholder="Ej: +57 300 000 0000"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Zona / Ciudad / Departamento <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        name="zona"
                                        type="text"
                                        placeholder="Ej: Medellín, Antioquia"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Canal de Venta <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        name="canal_venta"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-700"
                                    >
                                        <option value="">Selecciona un canal</option>
                                        <option value="Distribuidor">Distribuidor</option>
                                        <option value="Constructor">Constructor</option>
                                        <option value="Retail">Retail</option>
                                        <option value="Directo">Directo</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>

                            {/* Columna Derecha */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Nombre de Empresa / Cuenta <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        name="nombre_cuenta"
                                        type="text"
                                        placeholder="Ej: Constructora XYZ"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Email <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        name="email"
                                        type="email"
                                        placeholder="Ej: contacto@empresa.com"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Categoría <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        name="categoria"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-700"
                                    >
                                        <option value="">Selecciona una categoría</option>
                                        <option value="A">A - Alta Prioridad</option>
                                        <option value="B">B - Media Prioridad</option>
                                        <option value="C">C - Baja Prioridad</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Fecha Estimada de Cierre <span className="text-slate-400 font-normal">(Oportunidad - Opcional)</span></label>
                                    <input
                                        name="fecha_cierre"
                                        type="date"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Comentarios (Full Width) */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Comentarios <span className="text-red-500">*</span></label>
                            <textarea
                                required
                                name="comentarios"
                                rows={4}
                                placeholder="Detalles sobre el interés, productos, o acuerdos charlados en la feria..."
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
                            ></textarea>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-xs text-slate-500 font-medium">
                                * El usuario actual y la fecha/hora de registro se guardarán automáticamente.
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full sm:w-auto h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar Registro'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
