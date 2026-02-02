"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Save, Trash2, Target, TrendingUp, BarChart3, Calendar, Users, Flag, AlertCircle } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface GoalDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    goalId: string;
    onUpdate?: () => void;
    canDelete?: boolean;
}

export function GoalDetailModal({ isOpen, onClose, goalId, onUpdate, canDelete = false }: GoalDetailModalProps) {
    const [goal, setGoal] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit States
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [status, setStatus] = useState("");
    const [targetValue, setTargetValue] = useState(0);

    useEffect(() => {
        if (isOpen && goalId) {
            fetchGoal();
        }
    }, [isOpen, goalId]);

    const fetchGoal = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('CRM_Metas')
                .select(`
                    *,
                    opportunity:CRM_Oportunidades(id, nombre)
                `)
                .eq('id', goalId)
                .single();

            if (error) throw error;
            setGoal(data);

            // Init Form
            setDescription(data.description || "");
            setDueDate(data.due_date || "");
            setStatus(data.status);
            setTargetValue(data.target_value || 0);

        } catch (err: any) {
            console.error("Error fetching goal:", err);
            setError("No se pudo cargar la meta");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('CRM_Metas')
                .update({
                    description,
                    due_date: dueDate || null,
                    status,
                    target_value: targetValue,
                    updated_at: new Date().toISOString()
                })
                .eq('id', goalId);

            if (error) throw error;

            if (onUpdate) onUpdate();
            onClose();

        } catch (err: any) {
            console.error("Error updating goal:", err);
            setError("Error al actualizar");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Estás seguro de eliminar esta meta permanentemente?")) return;

        try {
            const { error } = await supabase
                .from('CRM_Metas')
                .update({ is_deleted: true })
                .eq('id', goalId);

            if (error) throw error;
            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Error eliminando");
        }
    };

    if (!isOpen) return null;

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'SPECIFIC_OPPORTUNITY': return <Target className="w-5 h-5" />;
            case 'WON_COUNT': return <TrendingUp className="w-5 h-5" />;
            case 'CONTACT_COUNT': return <Users className="w-5 h-5" />;
            default: return <BarChart3 className="w-5 h-5" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                    <div className="flex gap-3">
                        <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600 h-fit">
                            {isLoading ? <BarChart3 className="w-5 h-5" /> : getTypeIcon(goal?.goal_type)}
                        </div>
                        <div>
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 block">
                                Detalles de Meta
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 leading-tight">
                                {isLoading ? "Cargando..." : goal?.goal_type?.replace('_', ' ')}
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="py-12 text-center text-slate-400">Cargando información...</div>
                    ) : (
                        <div className="space-y-4">
                            {/* Target & Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Cantidad Objetivo</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-900"
                                        value={targetValue}
                                        onChange={(e) => setTargetValue(parseInt(e.target.value))}
                                        disabled={goal?.goal_type === 'SPECIFIC_OPPORTUNITY'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Estado</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="En Proceso">En Proceso</option>
                                        <option value="Terminado">Terminado</option>
                                        <option value="Fracasada">Fracasada</option>
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Descripción</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5">Fecha Vencimiento</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Linked Opportunity */}
                            {goal?.opportunity && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <label className="block text-xs font-bold text-blue-600 mb-1">Oportunidad Vinculada</label>
                                    <p className="font-bold text-slate-900">{goal.opportunity.nombre}</p>
                                    <p className="text-xs text-slate-500 mt-1 font-mono">{goal.opportunity.id}</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    {canDelete ? (
                        <button
                            onClick={handleDelete}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar Meta"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    ) : <div />}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? "Guardando..." : "Guardar Cambios"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
