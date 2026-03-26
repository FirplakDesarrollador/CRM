"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

type Props = {
    onComplete: () => void;
};

export function CommissionRulesUploader({ onComplete }: Props) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [errorDetails, setErrorDetails] = useState<string[]>([]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setStatus('idle');
        setMessage('Leyendo archivo...');
        setProgress(0);
        setErrorDetails([]);

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const XLSX = await import('xlsx');
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

                if (jsonData.length === 0) throw new Error('El archivo esta vacio');

                setMessage('Resolviendo referencias...');
                setProgress(20);

                // Resolve vendedor emails to UUIDs
                const vendedorEmails = new Set<string>();
                const cuentaNits = new Set<string>();
                const categoriaPrefixes = new Set<string>();

                for (const row of jsonData) {
                    const email = row['vendedor_email'] || row['email_vendedor'] || '';
                    const nit = (row['cuenta_nit'] || row['nit_cliente'] || '').toString();
                    const prefix = (row['categoria_prefijo'] || row['prefijo'] || '').toString();
                    if (email) vendedorEmails.add(email.toLowerCase().trim());
                    if (nit) cuentaNits.add(nit.trim());
                    if (prefix) categoriaPrefixes.add(prefix.substring(0, 6));
                }

                // Batch resolve
                const emailToId = new Map<string, string>();
                const nitToId = new Map<string, string>();
                const prefixToId = new Map<string, number>();

                if (vendedorEmails.size > 0) {
                    const { data: users } = await supabase
                        .from('CRM_Usuarios')
                        .select('id, email')
                        .in('email', Array.from(vendedorEmails));
                    users?.forEach(u => emailToId.set(u.email.toLowerCase(), u.id));
                }

                if (cuentaNits.size > 0) {
                    const { data: accounts } = await supabase
                        .from('CRM_Cuentas')
                        .select('id, nit')
                        .in('nit', Array.from(cuentaNits))
                        .eq('is_deleted', false);
                    accounts?.forEach(a => nitToId.set(a.nit, a.id));
                }

                if (categoriaPrefixes.size > 0) {
                    const { data: cats } = await supabase
                        .from('CRM_ComisionCategorias')
                        .select('id, prefijo')
                        .in('prefijo', Array.from(categoriaPrefixes))
                        .eq('is_active', true);
                    cats?.forEach(c => prefixToId.set(c.prefijo, c.id));
                }

                setProgress(50);
                setMessage(`Procesando ${jsonData.length} reglas...`);

                // Map rows to rules
                const errors: string[] = [];
                const rules = jsonData.map((row: any, idx: number) => {
                    const email = (row['vendedor_email'] || row['email_vendedor'] || '').toString().toLowerCase().trim();
                    const nit = (row['cuenta_nit'] || row['nit_cliente'] || '').toString().trim();
                    const prefix = (row['categoria_prefijo'] || row['prefijo'] || '').toString().substring(0, 6);
                    const pct = parseFloat(row['porcentaje_comision'] || row['porcentaje'] || row['comision'] || '0');

                    if (isNaN(pct) || pct < 0 || pct > 100) {
                        errors.push(`Fila ${idx + 2}: Porcentaje invalido (${row['porcentaje_comision']})`);
                        return null;
                    }

                    if (email && !emailToId.has(email)) {
                        errors.push(`Fila ${idx + 2}: Vendedor no encontrado (${email})`);
                    }
                    if (nit && !nitToId.has(nit)) {
                        errors.push(`Fila ${idx + 2}: Cliente no encontrado (NIT: ${nit})`);
                    }
                    if (prefix && !prefixToId.has(prefix)) {
                        errors.push(`Fila ${idx + 2}: Categoria no encontrada (${prefix})`);
                    }

                    return {
                        nombre: row['nombre'] || row['descripcion'] || `Regla CSV fila ${idx + 2}`,
                        vendedor_id: email ? (emailToId.get(email) || null) : null,
                        cuenta_id: nit ? (nitToId.get(nit) || null) : null,
                        categoria_id: prefix ? (prefixToId.get(prefix) || null) : null,
                        canal_id: row['canal_id'] || row['canal'] || null,
                        porcentaje_comision: pct,
                        vigencia_desde: row['vigencia_desde'] || row['desde'] || null,
                        vigencia_hasta: row['vigencia_hasta'] || row['hasta'] || null,
                        is_active: true,
                    };
                }).filter(Boolean);

                if (rules.length === 0) {
                    throw new Error('No se generaron reglas validas');
                }

                setProgress(70);

                // Batch upload
                const BATCH_SIZE = 500;
                for (let i = 0; i < rules.length; i += BATCH_SIZE) {
                    const batch = rules.slice(i, i + BATCH_SIZE);
                    const { error } = await supabase.rpc('admin_upsert_commission_rules', { p_rules: batch });
                    if (error) throw error;
                    setProgress(70 + Math.round(((i + batch.length) / rules.length) * 30));
                }

                setStatus('success');
                setMessage(`${rules.length} reglas creadas exitosamente.`);
                if (errors.length > 0) {
                    setErrorDetails(errors);
                }
                onComplete();
            } catch (err: any) {
                console.error('Upload error:', err);
                setStatus('error');
                setMessage('Error al procesar el archivo.');
                setErrorDetails([err.message || 'Error desconocido']);
            } finally {
                setIsUploading(false);
            }
        };

        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">Carga Masiva de Reglas</h3>
                    <p className="text-sm text-slate-500">Crea multiples reglas de comision desde un archivo Excel o CSV.</p>
                </div>
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center transition-colors hover:bg-slate-100/50">
                {isUploading ? (
                    <div className="space-y-4">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                        <p className="text-slate-600 font-medium">{message}</p>
                        <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-slate-400">{progress}% Completado</p>
                    </div>
                ) : status === 'success' ? (
                    <div className="space-y-4">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                        <p className="text-emerald-700 font-bold text-lg">Carga Exitosa</p>
                        <p className="text-slate-600">{message}</p>
                        <button onClick={() => setStatus('idle')} className="text-blue-600 text-sm font-bold hover:underline">
                            Subir otro archivo
                        </button>
                    </div>
                ) : (
                    <>
                        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-900 font-medium mb-1">Arrastra tu archivo o haz clic para seleccionar</p>
                        <p className="text-slate-500 text-xs mb-6">Formatos: .xlsx, .csv</p>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            id="rules-upload"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="rules-upload"
                            className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
                        >
                            Seleccionar Archivo
                        </label>
                    </>
                )}
            </div>

            {/* Warnings */}
            {status === 'success' && errorDetails.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-2">Advertencias ({errorDetails.length})</p>
                    <ul className="list-disc list-inside text-xs text-amber-700 font-mono space-y-1 max-h-32 overflow-y-auto">
                        {errorDetails.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            )}

            {/* Error */}
            {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-900 mb-1">Error en la carga</p>
                        <p className="text-xs text-red-700">{message}</p>
                        {errorDetails.length > 0 && (
                            <ul className="list-disc list-inside text-[10px] text-red-600 font-mono space-y-1 mt-2 max-h-32 overflow-y-auto">
                                {errorDetails.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        )}
                        <button onClick={() => setStatus('idle')} className="mt-3 text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1">
                            <X className="w-3 h-3" /> Intentar de nuevo
                        </button>
                    </div>
                </div>
            )}

            {/* CSV Structure Help */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wider">Estructura del archivo</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                    Columnas: <strong>nombre</strong>, <strong>porcentaje_comision</strong> (obligatorias).
                    Opcionales: <strong>vendedor_email</strong>, <strong>cuenta_nit</strong>, <strong>categoria_prefijo</strong>, <strong>canal_id</strong>, <strong>vigencia_desde</strong>, <strong>vigencia_hasta</strong>.
                    <br />Dejar vacio un campo de dimension significa &quot;aplica a todos&quot;.
                </p>
            </div>
        </div>
    );
}
