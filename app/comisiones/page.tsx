"use client";

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/lib/permissions';
import { CommissionDashboard } from '@/components/comisiones/CommissionDashboard';
import { BonusRulesManager } from '@/components/comisiones/BonusRulesManager';
import { CommissionCategoryManager } from '@/components/comisiones/CommissionCategoryManager';
import { CommissionLedgerTable } from '@/components/comisiones/CommissionLedgerTable';
import { useCommissionLedger } from '@/lib/hooks/useCommissionLedger';
import { useCommissionRules } from '@/lib/hooks/useCommissionRules';
import { CommissionRuleForm } from '@/components/comisiones/CommissionRuleForm';
import { CommissionRuleTable } from '@/components/comisiones/CommissionRuleTable';
import { CommissionRulesUploader } from '@/components/comisiones/CommissionRulesUploader';
import { DollarSign, LayoutDashboard, Settings, Target, Tag, BookOpen, Plus, Upload, Loader2, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';

type TabType = 'dashboard' | 'reglas' | 'bonos' | 'categorias' | 'ledger';

export default function ComisionesPage() {
    const { role, isLoading: userLoading } = useCurrentUser();
    const searchParams = useSearchParams();
    const router = useRouter();

    // Determine active tab from URL or default to dashboard
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');

    useEffect(() => {
        const tab = searchParams.get('tab') as TabType;
        if (tab && ['dashboard', 'reglas', 'bonos', 'categorias', 'ledger'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`/comisiones?${params.toString()}`);
    };

    // Permissions
    const canManageRules = hasPermission(role, 'manage_commission_rules');
    const canManageCategories = hasPermission(role, 'manage_commission_categories');
    const canViewLedger = hasPermission(role, 'view_all_commissions');
    const canAdjust = hasPermission(role, 'create_commission_adjustment');

    // Rules logic
    const {
        data: rulesData, count: rulesCount, loading: rulesLoading, hasMore: rulesHasMore, loadMore: rulesLoadMore, refresh: rulesRefresh,
        createRule, updateRule, deactivateRule,
        setCanalFilter, setVendedorFilter, setCategoriaFilter, setActiveFilter,
    } = useCommissionRules();

    const [showRuleForm, setShowRuleForm] = useState(false);
    const [showRuleUploader, setShowRuleUploader] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);

    // Ledger logic
    const {
        data: ledgerData, count: ledgerCount, loading: ledgerLoading, hasMore: ledgerHasMore, loadMore: ledgerLoadMore,
        setTipoFilter, setVendedorFilter: setLedgerVendedorFilter, setCanalFilter: setLedgerCanalFilter,
        setOportunidadFilter, setDateFrom, setDateTo, registerPayment
    } = useCommissionLedger();

    // Register Payment Form (simplified from ledger page)
    const [showPagadaForm, setShowPagadaForm] = useState(false);
    const [pagadaOppId, setPagadaOppId] = useState('');
    const [pagadaSapRef, setPagadaSapRef] = useState('');
    const [pagadaMonto, setPagadaMonto] = useState('');
    const [pagadaFecha, setPagadaFecha] = useState(new Date().toISOString().split('T')[0]);
    const [isPagadaSubmitting, setIsPagadaSubmitting] = useState(false);

    if (userLoading) {
        return (
            <div className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse">
                <div className="h-12 bg-slate-100 rounded-xl w-48" />
                <div className="h-64 bg-slate-100 rounded-3xl w-full" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Módulo de Comisiones</h1>
                        <p className="text-sm text-slate-500">
                            {canViewLedger ? 'Gestión centralizada de incentivos y bonos' : 'Tus comisiones y seguimiento'}
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-slate-100 p-1 rounded-xl items-center overflow-x-auto no-scrollbar">
                    <TabButton
                        active={activeTab === 'dashboard'}
                        onClick={() => handleTabChange('dashboard')}
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        label="Dashboard"
                    />
                    {canManageRules && (
                        <TabButton
                            active={activeTab === 'reglas'}
                            onClick={() => handleTabChange('reglas')}
                            icon={<Settings className="w-4 h-4" />}
                            label="Reglas"
                        />
                    )}
                    {canManageRules && (
                        <TabButton
                            active={activeTab === 'bonos'}
                            onClick={() => handleTabChange('bonos')}
                            icon={<Target className="w-4 h-4" />}
                            label="Bonos de Recaudo"
                        />
                    )}
                    {canManageCategories && (
                        <TabButton
                            active={activeTab === 'categorias'}
                            onClick={() => handleTabChange('categorias')}
                            icon={<Tag className="w-4 h-4" />}
                            label="Categorías"
                        />
                    )}
                    {canViewLedger && (
                        <TabButton
                            active={activeTab === 'ledger'}
                            onClick={() => handleTabChange('ledger')}
                            icon={<BookOpen className="w-4 h-4" />}
                            label="Ledger"
                        />
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {activeTab === 'dashboard' && <CommissionDashboard />}

                {activeTab === 'reglas' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">Reglas de Comisión Estándar</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowRuleUploader(!showRuleUploader)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                                >
                                    <Upload className="w-4 h-4" />
                                    Carga Masiva
                                </button>
                                <button
                                    onClick={() => { setShowRuleForm(true); setEditingRule(null); }}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#254153] rounded-xl hover:bg-[#1a2f3d] transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva Regla
                                </button>
                            </div>
                        </div>

                        {showRuleUploader && (
                            <CommissionRulesUploader onComplete={() => { setShowRuleUploader(false); rulesRefresh(); }} />
                        )}

                        {showRuleForm && (
                            <CommissionRuleForm
                                onSubmit={async (rule) => {
                                    if (editingRule) {
                                        await updateRule(editingRule.id, rule);
                                    } else {
                                        await createRule(rule);
                                    }
                                    setShowRuleForm(false);
                                    setEditingRule(null);
                                }}
                                onCancel={() => { setShowRuleForm(false); setEditingRule(null); }}
                                initialData={editingRule}
                            />
                        )}

                        <CommissionRuleTable
                            data={rulesData}
                            loading={rulesLoading}
                            hasMore={rulesHasMore}
                            count={rulesCount}
                            onLoadMore={rulesLoadMore}
                            onEdit={(rule) => { setEditingRule(rule); setShowRuleForm(true); }}
                            onDeactivate={deactivateRule}
                            onCanalFilter={setCanalFilter}
                            onActiveFilter={setActiveFilter}
                        />
                    </div>
                )}

                {activeTab === 'bonos' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Reglas de Bonos por Recaudo</h2>
                            <p className="text-sm text-slate-500">Define las metas de cobro y los premios asociados por periodo.</p>
                        </div>
                        <BonusRulesManager />
                    </div>
                )}

                {activeTab === 'categorias' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <CommissionCategoryManager />
                    </div>
                )}

                {activeTab === 'ledger' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">Historial Transaccional (Ledger)</h2>
                            {canAdjust && (
                                <button
                                    onClick={() => setShowPagadaForm(!showPagadaForm)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Registrar Pago SAP
                                </button>
                            )}
                        </div>

                        {showPagadaForm && (
                            <div className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300">
                                <h3 className="font-bold text-slate-900">Registrar Pago Recibido (PAGADA)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <input
                                        type="text"
                                        placeholder="ID Oportunidad"
                                        value={pagadaOppId}
                                        onChange={e => setPagadaOppId(e.target.value)}
                                        className="px-3 py-2 border rounded-xl text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Ref SAP"
                                        value={pagadaSapRef}
                                        onChange={e => setPagadaSapRef(e.target.value)}
                                        className="px-3 py-2 border rounded-xl text-sm"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Monto"
                                        value={pagadaMonto}
                                        onChange={e => setPagadaMonto(e.target.value)}
                                        className="px-3 py-2 border rounded-xl text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                setIsPagadaSubmitting(true);
                                                await registerPayment(pagadaOppId, Number(pagadaMonto), pagadaSapRef, pagadaFecha);
                                                setIsPagadaSubmitting(false);
                                                setShowPagadaForm(false);
                                            }}
                                            disabled={isPagadaSubmitting}
                                            className="flex-1 bg-blue-600 text-white rounded-xl text-sm font-bold"
                                        >
                                            {isPagadaSubmitting ? '...' : 'Guardar'}
                                        </button>
                                        <button onClick={() => setShowPagadaForm(false)} className="px-3 border rounded-xl">X</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <CommissionLedgerTable
                            data={ledgerData}
                            loading={ledgerLoading}
                            hasMore={ledgerHasMore}
                            count={ledgerCount}
                            onLoadMore={ledgerLoadMore}
                            onTipoFilter={setTipoFilter}
                            onVendedorFilter={setLedgerVendedorFilter}
                            onCanalFilter={setLedgerCanalFilter}
                            onDateFrom={setDateFrom}
                            onDateTo={setDateTo}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
        >
            {icon}
            {label}
        </button>
    );
}
