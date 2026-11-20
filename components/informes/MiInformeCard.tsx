"use client";

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

/**
 * Tarjeta "Mi informe": descarga un Excel con las cuentas, contactos,
 * oportunidades y actividades del usuario actual. El filtro por usuario
 * se aplica en el servidor (/api/informes/mi-informe).
 */
export function MiInformeCard({ compact = false }: { compact?: boolean }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDownload = async () => {
        setIsDownloading(true);
        setError(null);
        try {
            const res = await fetch('/api/informes/mi-informe', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Error ${res.status}`);
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="([^"]+)"/);
            const fileName = match?.[1] || 'Mi_informe.xlsx';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo descargar el informe');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${compact ? 'p-4' : 'p-5 sm:p-6'}`} data-testid="mi-informe-card">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-slate-800">Mi informe</h2>
                    <p className="text-sm text-slate-500">
                        Descarga en Excel tus cuentas, contactos, oportunidades y actividades (una hoja por cada una).
                        Solo incluye la información asignada a ti.
                    </p>
                    {error && <p className="text-sm text-red-600 font-medium mt-1">{error}</p>}
                </div>
                <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#254153] text-white font-semibold hover:bg-[#1a2f3c] disabled:opacity-60 shrink-0"
                    data-testid="mi-informe-download"
                >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isDownloading ? 'Generando…' : 'Descargar Excel'}
                </button>
            </div>
        </div>
    );
}
