"use client";

import { useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/permissions';
import { useCommissionRules, CommissionRule } from '@/lib/hooks/useCommissionRules';
import { CommissionRuleForm } from '@/components/comisiones/CommissionRuleForm';
import { CommissionRuleTable } from '@/components/comisiones/CommissionRuleTable';
import { CommissionRulesUploader } from '@/components/comisiones/CommissionRulesUploader';
import { Settings, Plus, Upload } from 'lucide-react';
import Link from 'next/link';

export default function ReglasComisionPage() {
    const { role, isLoading: userLoading } = useCurrentUser();
    const {
        data, count, loading, hasMore, loadMore, refresh,
        createRule, updateRule, deactivateRule,
        setCanalFilter, setVendedorFilter, setCategoriaFilter, setActiveFilter,
    } = useCommissionRules();

    const [showForm, setShowForm] = useState(false);
    const [showUploader, setShowUploader] = useState(false);
    const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);

    const handleCreate = async (rule: Parameters<typeof createRule>[0]) => {
        await createRule(rule);
        setShowForm(false);
    };

    const handleEdit = (rule: CommissionRule) => {
        setEditingRule(rule);
        setShowForm(true);
    };

    const handleUpdate = async (rule: Parameters<typeof createRule>[0]) => {
        if (editingRule) {
            await updateRule(editingRule.id, {
                nombre: rule.nombre,
                vendedor_id: rule.vendedor_id,
                cuenta_id: rule.cuenta_id,
                cuentas_ids: rule.cuentas_ids,
                categoria_id: rule.categoria_id,
                canal_id: rule.canal_id,
                porcentaje_comision: rule.porcentaje_comision,
                vigencia_desde: rule.vigencia_desde,
                vigencia_hasta: rule.vigencia_hasta,
            });
        }
        setEditingRule(null);
        setShowForm(false);
    };

    if (userLoading) {
        return (
            <div className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse">
                <div className="h-20 bg-slate-100 rounded-2xl w-full" />
                <div className="h-64 bg-slate-100 rounded-2xl w-full" />
            </div>
        );
    }

    if (!hasPermission(role, 'manage_commission_rules')) {
        return (
            <div className="max-w-7xl mx-auto p-6 text-center py-24">
                <p className="text-slate-500 font-medium">No tienes permisos para acceder a esta página.</p>
                <p className="text-sm text-slate-400 mt-2">Tu rol actual es: {role || 'Cargando...'}</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Reglas de Comisión</h1>
                        <p className="text-sm text-slate-500">Gestiona las reglas que determinan los porcentajes de comisión</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/comisiones" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        Volver
                    </Link>
                    <button
                        onClick={() => setShowUploader(!showUploader)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                    >
                        <Upload className="w-4 h-4" />
                        Carga Masiva
                    </button>
                    <button
                        onClick={() => { setShowForm(true); setEditingRule(null); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#254153] rounded-xl hover:bg-[#1a2f3d] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Regla
                    </button>
                </div>
            </div>

            {/* CSV Uploader */}
            {showUploader && (
                <CommissionRulesUploader onComplete={() => { setShowUploader(false); refresh(); }} />
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <CommissionRuleForm
                    onSubmit={editingRule ? handleUpdate : handleCreate}
                    onCancel={() => { setShowForm(false); setEditingRule(null); }}
                    initialData={editingRule ? {
                        nombre: editingRule.nombre || '',
                        vendedor_id: editingRule.vendedor_id,
                        cuenta_id: editingRule.cuenta_id,
                        cuentas_ids: editingRule.cuentas_ids,
                        categoria_id: editingRule.categoria_id,
                        canal_id: editingRule.canal_id,
                        porcentaje_comision: editingRule.porcentaje_comision,
                        vigencia_desde: editingRule.vigencia_desde,
                        vigencia_hasta: editingRule.vigencia_hasta,
                    } : undefined}
                />
            )}

            {/* Rules Table */}
            <CommissionRuleTable
                data={data}
                loading={loading}
                hasMore={hasMore}
                count={count}
                onLoadMore={loadMore}
                onEdit={handleEdit}
                onDeactivate={deactivateRule}
                onCanalFilter={setCanalFilter}
                onActiveFilter={setActiveFilter}
            />
        </div>
    );
}
