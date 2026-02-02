"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Save, AlertCircle, CheckCircle2, TrendingUp, Calendar, Hash } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface OpportunityQuickViewProps {
    opportunityId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

export function OpportunityQuickView({ opportunityId, isOpen, onClose, onUpdate }: OpportunityQuickViewProps) {
    const [opportunity, setOpportunity] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit Stats
    const [statusId, setStatusId] = useState<number | null>(null);
    const [phaseId, setPhaseId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && opportunityId) {
            fetchOpportunity();
        }
    }, [isOpen, opportunityId]);

    const fetchOpportunity = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('CRM_Oportunidades')
                .select('*')
                .eq('id', opportunityId)
                .single();

            if (error) throw error;
            setOpportunity(data);
            setStatusId(data.estado_id);
            setPhaseId(data.fase_id);

        } catch (err: any) {
            console.error("Error fetching opportunity:", err);
            setError("No se pudo cargar la oportunidad");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('CRM_Oportunidades')
                .update({
                    estado_id: statusId,
                    fase_id: phaseId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', opportunityId);

            if (error) throw error;

            if (onUpdate) onUpdate();
            onClose();

        } catch (err: any) {
            console.error("Error updating opportunity:", err);
            setError("Error al actualizar");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Oportunidad</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 leading-tight">
                            {isLoading ? "Cargando..." : opportunity?.nombre}
                        </h3>
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
                        <div className="py-8 text-center text-slate-400">Cargando detalles...</div>
                    ) : error ? (
                        <div className="text-red-500 text-center py-4">{error}</div>
                    ) : (
                        <>
                            {/* Key Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                                        <Hash className="w-3 h-3" />
                                        <span className="text-xs font-bold">Valor</span>
                                    </div>
                                    <p className="font-bold text-slate-900">
                                        ${opportunity?.amount?.toLocaleString()} {opportunity?.currency_id}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                                        <Calendar className="w-3 h-3" />
                                        <span className="text-xs font-bold">Cierre Est.</span>
                                    </div>
                                    <p className="font-bold text-slate-900 text-sm">
                                        {opportunity?.fecha_cierre_estimada || 'Sin Fecha'}
                                    </p>
                                </div>
                            </div>

                            {/* Status Edit */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Estado</label>
                                <select
                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900"
                                    value={statusId || 0}
                                    onChange={(e) => setStatusId(parseInt(e.target.value))}
                                >
                                    {/* Assuming standard IDs based on known values or generic placeholder for now. 
                                        Ideally fetch from CRM_Estados table if meaningful names needed. 
                                        Using generic IDs for Quick View context based on typical CRM flow.
                                    */}
                                    <option value={1}>Abierta</option>
                                    <option value={4}>Ganada</option>
                                    <option value={5}>Perdida</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center gap-2"
                    >
                        {isSaving ? "Guardando..." : "Actualizar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
