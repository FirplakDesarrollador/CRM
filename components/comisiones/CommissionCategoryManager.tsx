"use client";

import { useState } from 'react';
import { useCommissionCategories, CommissionCategory } from '@/lib/hooks/useCommissionCategories';
import { Upload, Plus, Search, AlertCircle, CheckCircle, Loader2, X, Layers, Wand2 } from 'lucide-react';

export function CommissionCategoryManager() {
    const { data: categories, loading, createCategory, updateCategory, bulkUpload, autoDetectPrefixes, refresh } = useCommissionCategories();

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ prefijo: '', nombre: '', descripcion: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // CSV upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Auto-detect state
    const [detectedPrefixes, setDetectedPrefixes] = useState<string[]>([]);
    const [showDetected, setShowDetected] = useState(false);

    const filtered = categories.filter(c =>
        c.prefijo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async () => {
        if (!formData.prefijo || !formData.nombre) return;
        setIsSubmitting(true);
        setMessage(null);
        try {
            if (editingId) {
                await updateCategory(editingId, { nombre: formData.nombre, descripcion: formData.descripcion || undefined });
                setMessage({ type: 'success', text: 'Categoria actualizada' });
            } else {
                await createCategory(formData);
                setMessage({ type: 'success', text: 'Categoria creada' });
            }
            setFormData({ prefijo: '', nombre: '', descripcion: '' });
            setShowForm(false);
            setEditingId(null);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Error al guardar' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (cat: CommissionCategory) => {
        setFormData({ prefijo: cat.prefijo, nombre: cat.nombre, descripcion: cat.descripcion || '' });
        setEditingId(cat.id);
        setShowForm(true);
    };

    const handleToggleActive = async (cat: CommissionCategory) => {
        try {
            await updateCategory(cat.id, { is_active: !cat.is_active });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);
        setMessage(null);

        try {
            const XLSX = await import('xlsx');
            const reader = new FileReader();

            reader.onload = async (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const workbook = XLSX.read(bstr, { type: 'binary' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

                    if (jsonData.length === 0) throw new Error('Archivo vacio');

                    const mapped = jsonData.map((row: any) => ({
                        prefijo: (row['prefijo'] || row['Prefijo'] || '').toString().substring(0, 6),
                        nombre: row['nombre'] || row['Nombre'] || row['categoria'] || row['Categoria'] || '',
                        descripcion: row['descripcion'] || row['Descripcion'] || '',
                    })).filter(r => r.prefijo && r.nombre);

                    if (mapped.length === 0) throw new Error('No se encontraron registros validos. Columnas requeridas: prefijo, nombre');

                    setUploadProgress(50);
                    const result = await bulkUpload(mapped);
                    setUploadProgress(100);
                    setMessage({ type: 'success', text: `${mapped.length} categorias procesadas exitosamente` });
                } catch (err: any) {
                    setMessage({ type: 'error', text: err.message });
                } finally {
                    setIsUploading(false);
                }
            };

            reader.readAsBinaryString(file);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
            setIsUploading(false);
        }

        e.target.value = '';
    };

    const handleAutoDetect = async () => {
        try {
            const prefixes = await autoDetectPrefixes();
            setDetectedPrefixes(prefixes);
            setShowDetected(true);
            if (prefixes.length === 0) {
                setMessage({ type: 'success', text: 'No se encontraron prefijos nuevos' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const handleBulkCreateDetected = async () => {
        if (detectedPrefixes.length === 0) return;
        setIsSubmitting(true);
        try {
            const cats = detectedPrefixes.map(p => ({ prefijo: p, nombre: `Categoria ${p}`, descripcion: 'Auto-detectada' }));
            await bulkUpload(cats);
            setDetectedPrefixes([]);
            setShowDetected(false);
            setMessage({ type: 'success', text: `${cats.length} categorias creadas. Edita los nombres para asignar nombres SAP correctos.` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2.5 rounded-xl text-purple-600">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-lg">Categorias de Producto</h2>
                        <p className="text-sm text-slate-500">Prefijos de 6 caracteres del codigo de articulo SAP</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAutoDetect}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 rounded-xl hover:bg-purple-100 transition-all"
                    >
                        <Wand2 className="w-4 h-4" />
                        Auto-detectar
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Cargar CSV
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} disabled={isUploading} />
                    </label>
                    <button
                        onClick={() => { setShowForm(true); setEditingId(null); setFormData({ prefijo: '', nombre: '', descripcion: '' }); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#254153] rounded-xl hover:bg-[#1a2f3d] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva
                    </button>
                </div>
            </div>

            {/* Messages */}
            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Upload progress */}
            {isUploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">Procesando archivo...</p>
                        <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
                            <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Auto-detected prefixes */}
            {showDetected && detectedPrefixes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-2">{detectedPrefixes.length} prefijos nuevos detectados:</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {detectedPrefixes.map(p => (
                            <span key={p} className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-mono text-amber-900">{p}</span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleBulkCreateDetected} disabled={isSubmitting} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-all disabled:opacity-50">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear todas'}
                        </button>
                        <button onClick={() => setShowDetected(false)} className="px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 rounded-xl transition-all">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
                    <h3 className="font-bold text-slate-900">{editingId ? 'Editar Categoria' : 'Nueva Categoria'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Prefijo (6 chars)</label>
                            <input
                                type="text"
                                maxLength={6}
                                value={formData.prefijo}
                                onChange={e => setFormData(f => ({ ...f, prefijo: e.target.value.toUpperCase() }))}
                                disabled={!!editingId}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono disabled:bg-slate-50 disabled:text-slate-400"
                                placeholder="VBAN13"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre</label>
                            <input
                                type="text"
                                value={formData.nombre}
                                onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                                placeholder="Sanitarios Banos"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Descripcion (opcional)</label>
                            <input
                                type="text"
                                value={formData.descripcion}
                                onChange={e => setFormData(f => ({ ...f, descripcion: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                                placeholder="Categoria SAP"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                        <button onClick={handleSubmit} disabled={isSubmitting || !formData.prefijo || !formData.nombre} className="px-4 py-2 text-sm font-bold text-white bg-[#254153] rounded-xl hover:bg-[#1a2f3d] transition-all disabled:opacity-50">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por prefijo o nombre..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-sm text-slate-500">
                        No hay categorias registradas
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Prefijo</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Descripcion</th>
                                <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Estado</th>
                                <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(cat => (
                                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">{cat.prefijo}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{cat.nombre}</td>
                                    <td className="px-4 py-3 text-sm text-slate-500">{cat.descripcion || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cat.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {cat.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => handleEdit(cat)} className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-all">Editar</button>
                                            <button onClick={() => handleToggleActive(cat)} className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                                {cat.is_active ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* CSV Structure Help */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">Estructura CSV para carga masiva</p>
                <p className="text-xs text-blue-700">
                    Columnas requeridas: <strong>prefijo</strong> (6 caracteres), <strong>nombre</strong>. Opcional: <strong>descripcion</strong>.
                </p>
            </div>
        </div>
    );
}
