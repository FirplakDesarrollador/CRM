"use client";

import { useState, useEffect } from 'react';
import { useConfig } from '@/lib/hooks/useConfig';
import { Loader2, Save, Info } from 'lucide-react';

export function CommissionSettings() {
    const { config, isLoading, updateConfig } = useConfig();
    const [isSaving, setIsSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const [form, setForm] = useState({
        creator_pct: '5',
        owner_pct: '95'
    });

    useEffect(() => {
        if (config && Object.keys(config).length > 0) {
            setForm({
                creator_pct: config.commission_creator_default_pct || '5',
                owner_pct: config.commission_owner_default_pct || '95'
            });
        }
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        setSuccessMsg('');
        
        const success1 = await updateConfig('commission_creator_default_pct', form.creator_pct);
        const success2 = await updateConfig('commission_owner_default_pct', form.owner_pct);

        if (success1 && success2) {
            setSuccessMsg('Configuración guardada exitosamente');
            setTimeout(() => setSuccessMsg(''), 3000);
        }
        
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800">Configuración Global de Comisiones</h2>
                <p className="text-sm text-slate-500">
                    Define los porcentajes por defecto para la creación de oportunidades sobre cuentas de terceros.
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">¿Cómo funciona esta regla?</p>
                    <p>Cuando un vendedor crea una oportunidad para una cuenta que <strong>no es de su propiedad</strong>:</p>
                    <ul className="list-disc ml-4 mt-1 space-y-0.5">
                        <li>El vendedor que <strong>crea</strong> la oportunidad recibe el % configurado como "Creador".</li>
                        <li>El <strong>dueño</strong> original de la cuenta recibe el % configurado como "Dueño".</li>
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Comisión para el Creador (%)</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={form.creator_pct}
                            onChange={e => setForm(f => ({ ...f, creator_pct: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="5"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic">Porcentaje asignado al vendedor que registra la oportunidad.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Comisión para el Dueño (%)</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={form.owner_pct}
                            onChange={e => setForm(f => ({ ...f, owner_pct: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="95"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic">Porcentaje asignado al dueño original de la cuenta.</p>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                    {successMsg && (
                        <span className="text-sm font-bold text-emerald-600 animate-in fade-in slide-in-from-left-2">
                            {successMsg}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-200"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Configuración
                </button>
            </div>
        </div>
    );
}
