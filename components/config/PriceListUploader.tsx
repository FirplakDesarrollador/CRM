"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/components/ui/utils';

export function PriceListUploader() {
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
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length === 0) {
                    throw new Error("El archivo está vacío o no tiene datos legibles.");
                }

                // Validation
                // Must have 'numero_articulo' (mapped from 'Número de artículo' or similar in reality, but implementation said structure matches required repopulation)
                // The prompt said: "archivo ya tiene la estructura de datos requerida".
                // So we assume keys match DB columns or we map them?
                // The previous Excel had "Número de artículo" -> we mapped to "numero_articulo".
                // Let's try to detect or normalize keys to lowercase/underscore if needed, OR assume user provides correct keys?
                // Prompt: "ese archivo ya tienen la estructura de datos requerida para repopular"
                // This implies keys might need to assume 1:1 match with DB columns OR we support the "standard" format we saw before?
                // Let's support the Standard format we saw (Column A=numero_articulo) AND DB keys.

                // Let's Normalize Keys function
                const normalizedData = jsonData.map((row: any) => {
                    // Try to finding known keys by slight variations if needed, or trust input.
                    // Let's implement robust mapping based on what we saw in the Excel inspection.
                    // 'Número de artículo' -> numero_articulo
                    // 'Descripción' -> descripcion
                    // 'Precio base general' -> lista_base_cop
                    // 'Distribución exterior' -> lista_base_exportaciones
                    // But maybe the user will provide a CSV exported FROM the system or prepared for it?
                    // Let's assume keys MIGHT be Spanish headers OR db columns.
                    // Prioritize exact DB column match, fallback to Spanish headers.

                    const getKey = (keys: string[]) => keys.find(k => row[k] !== undefined);

                    return {
                        numero_articulo: row['numero_articulo'] || row['Número de artículo'] || row['Articulo'] || row['Codigo'],
                        descripcion: row['descripcion'] || row['Descripción'] || row['Nombre'],
                        lista_base_cop: parseNumber(row['lista_base_cop'] || row['Precio base general'] || row['COP']),
                        lista_base_exportaciones: parseNumber(row['lista_base_exportaciones'] || row['Distribución exterior'] || row['USD']),
                        lista_base_obras: parseNumber(row['lista_base_obras'] || row['Obras nacional']),
                        distribuidor_pvp_iva: parseNumber(row['distribuidor_pvp_iva'] || row['Distribuidor PVP+IVA']),
                        pvp_sin_iva: parseNumber(row['pvp_sin_iva'] || row['PVP sin IVA']),
                        descuentos_volumen: parseJSON(row['descuentos_volumen'] || row['Politica de descuentos'])
                    };
                });

                // Validate Row 1
                if (!normalizedData[0].numero_articulo) {
                    throw new Error("No se encontró la columna 'numero_articulo' o 'Número de artículo'. Verifique la estructura.");
                }

                setMessage(`Procesando ${normalizedData.length} registros...`);

                // Batch Upload
                const BATCH_SIZE = 1000;
                const total = normalizedData.length;
                let processed = 0;

                for (let i = 0; i < total; i += BATCH_SIZE) {
                    const batch = normalizedData.slice(i, i + BATCH_SIZE);

                    // Filter invalid rows (no ID)
                    const validBatch = batch.filter((r: any) => r.numero_articulo);

                    if (validBatch.length > 0) {
                        const { error } = await supabase.rpc('admin_upsert_price_list', { prices: validBatch });
                        if (error) throw error;
                    }

                    processed += batch.length;
                    setProgress(Math.round((processed / total) * 100));
                }

                setStatus('success');
                setMessage(`Se han actualizado ${total} productos correctamente.`);

            } catch (err: any) {
                console.error("Upload error:", err);
                setStatus('error');
                setMessage("Error al procesar el archivo.");
                setErrorDetails([err.message || 'Error desconocido']);
            } finally {
                setIsUploading(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    const parseNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            // Remove $ , spaces
            const clean = val.replace(/[$,\s]/g, '');
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    const parseJSON = (val: any) => {
        if (!val) return null;
        if (typeof val === 'object') return val; // Already an object (unexpected in CSV but possible if Excel parser is smart)
        try {
            // Replace single quotes effectively if user uses them (JSON strict is double quotes)
            // But basic JSON.parse expects standard JSON syntax.
            // If user puts "{...}" in Excel cell, it comes as string.
            return JSON.parse(val);
        } catch (e) {
            console.warn("Invalid JSON for discounts:", val);
            return null;
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">Carga Masiva de Precios</h3>
                    <p className="text-sm text-slate-500">Actualiza la tabla de precios mediante archivo Excel o CSV.</p>
                </div>
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center transition-colors hover:bg-slate-100/50">
                {isUploading ? (
                    <div className="space-y-4">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                        <p className="text-slate-600 font-medium">{message}</p>
                        <div className="w-full max-w-md mx-auto bg-slate-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-400">{progress}% Completado</p>
                    </div>
                ) : status === 'success' ? (
                    <div className="space-y-4">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                        <p className="text-emerald-700 font-bold text-lg">¡Carga Exitosa!</p>
                        <p className="text-slate-600">{message}</p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="text-blue-600 text-sm font-bold hover:underline"
                        >
                            Subir otro archivo
                        </button>
                    </div>
                ) : (
                    <>
                        <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-900 font-medium mb-1">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                        <p className="text-slate-500 text-xs mb-6">Formatos soportados: .xlsx, .csv</p>

                        <input
                            type="file"
                            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            className="hidden"
                            id="price-list-upload"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="price-list-upload"
                            className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
                        >
                            Seleccionar Archivo
                        </label>
                    </>
                )}
            </div>

            {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-900 mb-1">Error en la carga</p>
                        <p className="text-xs text-red-700 mb-2">{message}</p>
                        {errorDetails.length > 0 && (
                            <ul className="list-disc list-inside text-[10px] text-red-600 font-mono space-y-1 bg-white/50 p-2 rounded max-h-32 overflow-y-auto">
                                {errorDetails.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        )}
                        <button
                            onClick={() => setStatus('idle')}
                            className="mt-3 text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> Intentar de nuevo
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Estructura Requerida
                </p>
                <p className="text-xs text-blue-700 leading-relaxed">
                    El archivo debe contener obligatoriamente la columna <strong>numero_articulo</strong> (o 'Número de artículo').
                    Las columnas de precios opcionales son: <em>lista_base_cop, lista_base_exportaciones, lista_base_obras, distribuidor_pvp_iva, pvp_sin_iva</em>.
                    <br />
                    Para la política de descuentos, usa la columna <strong>descuentos_volumen</strong> con formato JSON válido (ej. <code>{`{"DIST_NAC": [{"min_qty": 10, "discount_pct": 5}]}`}</code>).
                </p>
            </div>
        </div>
    );
}
