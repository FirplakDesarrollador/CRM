"use client";

import { useState } from 'react';
import { LedgerEntry } from '@/lib/hooks/useCommissionLedger';
import { Loader2, X } from 'lucide-react';

type Props = {
    entry: LedgerEntry;
    mode: 'AJUSTE' | 'REVERSO';
    onConfirm: (entradaId: string, monto: number, motivo: string) => Promise<void>;
    onClose: () => void;
};

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency || 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function CommissionAdjustmentModal({ entry, mode, onConfirm, onClose }: Props) {
    const [monto, setMonto] = useState('');
    const [motivo, setMotivo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!motivo.trim()) {
            setError('El motivo es obligatorio');
            return;
        }

        if (mode === 'AJUSTE') {
            const m = parseFloat(monto);
            if (isNaN(m) || m === 0) {
                setError('El monto del ajuste debe ser un numero diferente de cero');
                return;
            }
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const amount = mode === 'REVERSO' ? -entry.monto_comision : parseFloat(monto);
            await onConfirm(entry.id, amount, motivo.trim());
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al procesar');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-900">
                        {mode === 'REVERSO' ? 'Reversar Comision' : 'Ajustar Comision'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>

                {/* Reference entry */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Entrada original</p>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">{entry.oportunidad?.nombre || 'Oportunidad'}</span>
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(entry.monto_comision, entry.currency_id)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{entry.vendedor?.full_name} | {entry.cuenta?.nombre}</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
                )}

                {/* Amount (only for AJUSTE) */}
                {mode === 'AJUSTE' && (
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Monto del ajuste (positivo o negativo)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={monto}
                            onChange={e => setMonto(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                            placeholder="-50000"
                        />
                    </div>
                )}

                {mode === 'REVERSO' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <p className="text-sm text-red-700">Se creara una entrada de reverso por</p>
                        <p className="text-lg font-bold text-red-800">{formatCurrency(-entry.monto_comision, entry.currency_id)}</p>
                    </div>
                )}

                {/* Motivo */}
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo *</label>
                    <textarea
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none"
                        rows={3}
                        placeholder="Explica la razon del ajuste o reverso..."
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`px-6 py-2 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-50 ${mode === 'REVERSO' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'REVERSO' ? 'Confirmar Reverso' : 'Registrar Ajuste'}
                    </button>
                </div>
            </div>
        </div>
    );
}
