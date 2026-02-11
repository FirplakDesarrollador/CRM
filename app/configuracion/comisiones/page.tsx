"use client";

import { BonusRulesManager } from '@/components/comisiones/BonusRulesManager';

export default function CommissionConfigurationPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configuración de Comisiones</h1>
                <p className="text-slate-500">Administra las reglas de cálculo y bonificaciones para los vendedores.</p>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="mb-6 pb-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-800">Reglas de Bonos (Recaudo)</h2>
                        <p className="text-sm text-slate-500">Defina los montos objetivo y los bonos otorgados al cumplirlos.</p>
                    </div>
                    <BonusRulesManager />
                </div>

                {/* Future: Standard Commission Rules */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 opacity-60">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Reglas de Comisión Estandar</h2>
                        <p className="text-sm text-slate-500">Comisiones porcentuales por venta (Próximamente).</p>
                    </div>
                    <div className="h-32 bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-200">
                        <span className="text-slate-400 text-sm">Próximamente...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
