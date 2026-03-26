"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Shield, X } from 'lucide-react';

type RuleFormProps = {
    onSubmit: (rule: {
        nombre: string;
        vendedor_id: string | null;
        cuenta_id: string | null;
        cuentas_ids: string[] | null;
        categoria_id: number | null;
        canal_id: string | null;
        porcentaje_comision: number;
        vigencia_desde: string;
        vigencia_hasta: string | null;
    }) => Promise<void>;
    initialData?: {
        nombre: string;
        vendedor_id: string | null;
        cuenta_id: string | null;
        cuentas_ids: string[] | null;
        categoria_id: number | null;
        canal_id: string | null;
        porcentaje_comision: number;
        vigencia_desde: string;
        vigencia_hasta: string | null;
    };
    onCancel: () => void;
};

export function CommissionRuleForm({ onSubmit, initialData, onCancel }: RuleFormProps) {
    const [form, setForm] = useState({
        nombre: initialData?.nombre || '',
        vendedor_id: initialData?.vendedor_id || '',
        cuenta_id: initialData?.cuenta_id || '',
        cuentas_ids: initialData?.cuentas_ids || (initialData?.cuenta_id ? [initialData.cuenta_id] : []),
        categoria_id: initialData?.categoria_id?.toString() || '',
        canal_id: initialData?.canal_id || '',
        porcentaje_comision: initialData?.porcentaje_comision?.toString() || '',
        vigencia_desde: initialData?.vigencia_desde || new Date().toISOString().split('T')[0],
        vigencia_hasta: initialData?.vigencia_hasta || '',
    });

    const [selectedCuentas, setSelectedCuentas] = useState<{ id: string; nombre: string }[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reference data
    const [vendedores, setVendedores] = useState<{ id: string; full_name: string }[]>([]);
    const [canales, setCanales] = useState<{ id: string; nombre: string }[]>([]);
    const [categorias, setCategorias] = useState<{ id: number; prefijo: string; nombre: string }[]>([]);
    const [cuentaSearch, setCuentaSearch] = useState('');
    const [cuentas, setCuentas] = useState<{ id: string; nombre: string; nit: string }[]>([]);

    // Load reference data
    useEffect(() => {
        const loadData = async () => {
            const [vendResult, canalResult, catResult] = await Promise.all([
                supabase.from('CRM_Usuarios').select('id, full_name').eq('is_active', true).order('full_name'),
                supabase.from('CRM_Canales').select('id, nombre'),
                supabase.from('CRM_ComisionCategorias').select('id, prefijo, nombre').eq('is_active', true).order('prefijo'),
            ]);
            if (vendResult.data) setVendedores(vendResult.data);
            if (canalResult.data) setCanales(canalResult.data);
            if (catResult.data) setCategorias(catResult.data);
        };
        loadData();
    }, []);

    // Load account names for display when accounts are passed from initialData or changed
    useEffect(() => {
        if (form.cuentas_ids && form.cuentas_ids.length > 0) {
            // Only fetch if we don't already have these names in selectedCuentas
            const missingIds = form.cuentas_ids.filter(id => !selectedCuentas.some(sc => sc.id === id));

            if (missingIds.length > 0 || (form.cuentas_ids.length !== selectedCuentas.length)) {
                supabase
                    .from('CRM_Cuentas')
                    .select('id, nombre')
                    .in('id', form.cuentas_ids)
                    .then(({ data }) => {
                        if (data) setSelectedCuentas(data);
                    });
            }
        } else if (form.cuentas_ids.length === 0 && selectedCuentas.length > 0) {
            setSelectedCuentas([]);
        }
    }, [form.cuentas_ids]);


    // Search cuentas
    useEffect(() => {
        if (cuentaSearch.length < 2) { setCuentas([]); return; }
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('CRM_Cuentas')
                .select('id, nombre, nit')
                .eq('is_deleted', false)
                .ilike('nombre', `%${cuentaSearch}%`)
                .limit(10);
            if (data) setCuentas(data);
        }, 300);
        return () => clearTimeout(timer);
    }, [cuentaSearch]);

    // Calculate priority score preview
    const priorityScore =
        (form.vendedor_id ? 8 : 0) +
        ((form.cuenta_id || form.cuentas_ids.length > 0) ? 4 : 0) +
        (form.categoria_id ? 2 : 0) +
        (form.canal_id ? 1 : 0);

    const handleSubmit = async () => {
        if (!form.nombre || !form.porcentaje_comision) {
            setError('Nombre y porcentaje son obligatorios');
            return;
        }
        const pct = parseFloat(form.porcentaje_comision);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            setError('Porcentaje debe estar entre 0 y 100');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                nombre: form.nombre,
                vendedor_id: form.vendedor_id || null,
                cuenta_id: form.cuentas_ids[0] || null, // Keep for legacy
                cuentas_ids: form.cuentas_ids.length > 0 ? form.cuentas_ids : null,
                categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
                canal_id: form.canal_id || null,
                porcentaje_comision: pct,
                vigencia_desde: form.vigencia_desde,
                vigencia_hasta: form.vigencia_hasta || null,
            });
        } catch (err: any) {
            setError(err.message || 'Error al guardar la regla');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">{initialData ? 'Editar Regla' : 'Nueva Regla de Comision'}</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600">Prioridad: {priorityScore}</span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre / Descripcion de la regla *</label>
                    <input
                        type="text"
                        value={form.nombre}
                        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                        placeholder="Ej: Comision base canal distribucion"
                    />
                </div>

                {/* Vendedor */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Vendedor <span className="text-slate-400">(+8 prioridad)</span></label>
                    <select
                        value={form.vendedor_id}
                        onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    >
                        <option value="">Todos los vendedores</option>
                        {vendedores.map(v => (
                            <option key={v.id} value={v.id}>{v.full_name}</option>
                        ))}
                    </select>
                </div>

                {/* Cuenta/Cliente Multi-select */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Clientes <span className="text-slate-400">(Opcional, +4 prioridad)</span></label>
                    <div className="space-y-2">
                        {/* Selected tags */}
                        {selectedCuentas.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedCuentas.map(c => (
                                    <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                                        {c.nombre}
                                        <button
                                            onClick={() => {
                                                setForm(f => ({ ...f, cuentas_ids: f.cuentas_ids.filter(id => id !== c.id) }));
                                                setSelectedCuentas(s => s.filter(item => item.id !== c.id));
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <input
                                type="text"
                                value={cuentaSearch}
                                onChange={e => setCuentaSearch(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                                placeholder="Buscar y agregar clientes..."
                            />
                            {cuentas.length > 0 && (
                                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                    {cuentas.map(c => (
                                        <button
                                            key={c.id}
                                            disabled={form.cuentas_ids.includes(c.id)}
                                            onClick={() => {
                                                setForm(f => ({ ...f, cuentas_ids: [...f.cuentas_ids, c.id] }));
                                                setSelectedCuentas(s => [...s, { id: c.id, nombre: c.nombre }]);
                                                setCuentaSearch('');
                                                setCuentas([]);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                                        >
                                            <span className="font-medium">{c.nombre}</span>
                                            <span className="text-slate-400 ml-2 text-xs">NIT: {c.nit}</span>
                                            {form.cuentas_ids.includes(c.id) && <span className="float-right text-[10px] text-emerald-600 font-bold uppercase mt-1">Agregado</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Categoria */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria <span className="text-slate-400">(+2 prioridad)</span></label>
                    <select
                        value={form.categoria_id}
                        onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    >
                        <option value="">Todas las categorias</option>
                        {categorias.map(c => (
                            <option key={c.id} value={c.id}>{c.prefijo} - {c.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Canal */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Canal <span className="text-slate-400">(+1 prioridad)</span></label>
                    <select
                        value={form.canal_id}
                        onChange={e => setForm(f => ({ ...f, canal_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    >
                        <option value="">Todos los canales</option>
                        {canales.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Porcentaje */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Porcentaje de comision *</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={form.porcentaje_comision}
                            onChange={e => setForm(f => ({ ...f, porcentaje_comision: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm pr-8"
                            placeholder="5.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                    </div>
                </div>

                {/* Vigencia Desde */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Vigencia desde</label>
                    <input
                        type="date"
                        value={form.vigencia_desde}
                        onChange={e => setForm(f => ({ ...f, vigencia_desde: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    />
                </div>

                {/* Vigencia Hasta */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Vigencia hasta <span className="text-slate-400">(vacio = indefinida)</span></label>
                    <input
                        type="date"
                        value={form.vigencia_hasta}
                        onChange={e => setForm(f => ({ ...f, vigencia_hasta: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    />
                </div>
            </div>

            {/* Priority explanation */}
            <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">
                    <strong>Prioridad {priorityScore}/15:</strong> Las reglas mas especificas siempre ganan.
                    {priorityScore === 0 && ' Esta regla aplica a todos (regla general).'}
                    {priorityScore > 0 && priorityScore < 8 && ' Regla con especificidad parcial.'}
                    {priorityScore >= 8 && ' Regla altamente especifica.'}
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2 text-sm font-bold text-white bg-[#254153] rounded-xl hover:bg-[#1a2f3d] transition-all disabled:opacity-50"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : initialData ? 'Actualizar' : 'Crear Regla'}
                </button>
            </div>
        </div>
    );
}
