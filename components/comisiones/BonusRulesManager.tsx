"use client";

import { useState } from 'react';
import { useBonusRules, BonusRule } from '@/lib/hooks/useBonusRules';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Search, DollarSign, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function BonusRulesManager() {
    const { rules, loading, createRule, updateRule, deleteRule, toggleActive } = useBonusRules();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<BonusRule> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredRules = rules.filter(r =>
        r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.vendedor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = async () => {
        if (!editingRule?.nombre || !editingRule.meta_recaudo || !editingRule.monto_bono) return;

        setIsSubmitting(true);
        try {
            if (editingRule.id) {
                await updateRule(editingRule.id, editingRule);
            } else {
                await createRule({
                    nombre: editingRule.nombre,
                    vendedor_id: editingRule.vendedor_id || null, // null is handled in hook but explicit here
                    periodo: editingRule.periodo || 'MENSUAL',
                    meta_recaudo: Number(editingRule.meta_recaudo),
                    monto_bono: Number(editingRule.monto_bono),
                    currency_id: editingRule.currency_id || 'COP',
                    is_active: editingRule.is_active ?? true
                });
            }
            setIsModalOpen(false);
            setEditingRule(null);
        } catch (e) {
            console.error(e);
            alert('Error al guardar la regla');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openNew = () => {
        setEditingRule({
            nombre: '',
            periodo: 'MENSUAL',
            meta_recaudo: 0,
            monto_bono: 0,
            currency_id: 'COP',
            is_active: true
        });
        setIsModalOpen(true);
    };

    const openEdit = (rule: BonusRule) => {
        setEditingRule(rule);
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar bonos..."
                        className="pl-9 h-9 bg-slate-50 border-slate-200"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={openNew} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4" /> Nueva Regla
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRules.map(rule => (
                    <div key={rule.id} className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${rule.is_active ? 'border-slate-200' : 'border-slate-100 opacity-70 bg-slate-50'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-slate-800 line-clamp-1" title={rule.nombre}>{rule.nombre}</h3>
                                <p className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-1">
                                    {rule.periodo}
                                </p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openEdit(rule)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => toggleActive(rule.id, rule.is_active)} className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors ${rule.is_active ? 'text-emerald-500' : 'text-slate-300'}`}>
                                    {rule.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="flex items-center gap-2 text-indigo-700">
                                    <Target className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Meta</span>
                                </div>
                                <span className="font-bold text-indigo-900">{formatCurrency(rule.meta_recaudo)}</span>
                            </div>

                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Bono</span>
                                </div>
                                <span className="font-black text-emerald-700 text-lg">{formatCurrency(rule.monto_bono)}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-xs text-slate-400 font-medium">
                                {rule.vendedor ? rule.vendedor.full_name : 'Global (Todos)'}
                            </span>
                            {!rule.is_active && <span className="text-xs font-bold text-slate-300 uppercase">Inactivo</span>}
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingRule?.id ? 'Editar Regla de Bono' : 'Nueva Regla de Bono'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre de la Regla</Label>
                            <Input
                                id="nombre"
                                value={editingRule?.nombre || ''}
                                onChange={e => setEditingRule(prev => ({ ...prev, nombre: e.target.value }))}
                                placeholder="Ej: Bono Trimestral Q1 2026"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="meta">Meta de Recaudo</Label>
                                <Input
                                    id="meta"
                                    type="number"
                                    value={editingRule?.meta_recaudo || ''}
                                    onChange={e => setEditingRule(prev => ({ ...prev, meta_recaudo: Number(e.target.value) }))}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bono">Monto del Bono</Label>
                                <Input
                                    id="bono"
                                    type="number"
                                    value={editingRule?.monto_bono || ''}
                                    onChange={e => setEditingRule(prev => ({ ...prev, monto_bono: Number(e.target.value) }))}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="periodo">Periodo</Label>
                                <select
                                    id="periodo"
                                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                    value={editingRule?.periodo || 'MENSUAL'}
                                    onChange={e => setEditingRule(prev => ({ ...prev, periodo: e.target.value as any }))}
                                >
                                    <option value="MENSUAL">Mensual</option>
                                    <option value="TRIMESTRAL">Trimestral</option>
                                    <option value="ANUAL">Anual</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vendedor">Vendedor (Opcional)</Label>
                                <Input
                                    id="vendedor"
                                    value={editingRule?.vendedor_id || ''} // In MVP this needs a Dropdown, but for now Input ID
                                    onChange={e => setEditingRule(prev => ({ ...prev, vendedor_id: e.target.value }))}
                                    placeholder="UUID del Vendedor o Vacío"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
