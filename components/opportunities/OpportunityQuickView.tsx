"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { X, TrendingUp, Calendar, Hash, Percent } from "lucide-react";
import { ProbabilityDonut } from "@/components/ui/ProbabilityDonut";

interface OpportunityQuickViewProps {
    opportunityId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

type PhaseOption = {
    id: number;
    nombre: string;
    orden?: number;
    probability?: number | null;
};

type OpportunityRecord = {
    id: string;
    nombre?: string;
    amount?: number;
    currency_id?: string;
    fecha_cierre_estimada?: string | null;
    estado_id?: number | null;
    fase_id?: number | null;
    probability?: number | null;
    fase_detail?: { probability?: number | null } | null;
    cuenta?: { canal_id?: string | null } | null;
};

export function OpportunityQuickView({ opportunityId, isOpen, onClose, onUpdate }: OpportunityQuickViewProps) {
    const [opportunity, setOpportunity] = useState<OpportunityRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit Stats
    const [statusId, setStatusId] = useState<number | null>(null);
    const [phaseId, setPhaseId] = useState<number | null>(null);
    const [phaseOptions, setPhaseOptions] = useState<PhaseOption[]>([]);

    const fetchOpportunity = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: opp, error } = await supabase
                .from('CRM_Oportunidades')
                .select(`
                    *,
                    fase_detail:CRM_FasesOportunidad(probability),
                    cuenta:CRM_Cuentas(canal_id)
                `)
                .eq('id', opportunityId)
                .single<OpportunityRecord>();

            if (error) throw error;

            let channelPhases: PhaseOption[] = [];
            const canalId = opp.cuenta?.canal_id;
            if (canalId) {
                const { data: phases, error: phasesError } = await supabase
                    .from('CRM_FasesOportunidad')
                    .select('id, nombre, orden, probability')
                    .eq('canal_id', canalId)
                    .eq('is_active', true)
                    .order('orden')
                    .returns<PhaseOption[]>();

                if (phasesError) throw phasesError;
                channelPhases = phases || [];
            }

            // Map the probability from the joined phase if the opportunity probability is missing/zero
            const probability = opp.probability || opp.fase_detail?.probability || 0;
            setOpportunity({ ...opp, probability });
            setStatusId(opp.estado_id ?? null);
            setPhaseId(opp.fase_id ?? null);
            setPhaseOptions(channelPhases);

        } catch (err) {
            console.error("Error fetching opportunity:", err);
            setError("No se pudo cargar la oportunidad");
        } finally {
            setIsLoading(false);
        }
    }, [opportunityId]);

    useEffect(() => {
        if (isOpen && opportunityId) {
            fetchOpportunity();
        }
    }, [fetchOpportunity, isOpen, opportunityId]);

    const normalizePhaseName = (name?: string) =>
        (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const isClosedPhase = (phase?: PhaseOption) => {
        const name = normalizePhaseName(phase?.nombre);
        return name.includes('ganada') || name.includes('perdida');
    };

    const findPhaseForStatus = (nextStatusId: number) => {
        if (nextStatusId === 2) {
            return phaseOptions.find(phase => normalizePhaseName(phase.nombre).includes('ganada'));
        }

        if (nextStatusId === 3) {
            return phaseOptions.find(phase => normalizePhaseName(phase.nombre).includes('perdida'));
        }

        if (nextStatusId === 1) {
            const currentPhase = phaseOptions.find(phase => phase.id === phaseId);
            if (!currentPhase || isClosedPhase(currentPhase)) {
                return phaseOptions.find(phase => !isClosedPhase(phase));
            }
        }

        return null;
    };

    const handleStatusChange = (nextStatusId: number) => {
        setStatusId(nextStatusId);
        const matchingPhase = findPhaseForStatus(nextStatusId);
        if (matchingPhase) setPhaseId(matchingPhase.id);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const targetPhase = phaseOptions.find(phase => phase.id === phaseId);
            const { error } = await supabase
                .from('CRM_Oportunidades')
                .update({
                    estado_id: statusId,
                    fase_id: phaseId,
                    probability: targetPhase?.probability ?? opportunity?.probability,
                    updated_at: new Date().toISOString()
                })
                .eq('id', opportunityId);

            if (error) throw error;

            if (onUpdate) onUpdate();
            onClose();

        } catch (err) {
            console.error("Error updating opportunity:", err);
            setError("Error al actualizar");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
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

                            {/* Probability */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                                        <Percent className="w-4 h-4" />
                                        <span className="text-sm font-bold">Probabilidad de Éxito</span>
                                    </div>
                                    <p className="text-xs text-slate-400 max-w-[150px]">
                                        Calculado automáticamente según la etapa del proceso
                                    </p>
                                </div>
                                <ProbabilityDonut
                                    percentage={opportunity?.probability || 0}
                                    size={64}
                                    strokeWidth={6}
                                />
                            </div>

                            {/* Status Edit */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Estado</label>
                                <select
                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900"
                                    value={statusId || 0}
                                    onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                                >
                                    <option value={1}>Abierta</option>
                                    <option value={2}>Ganada</option>
                                    <option value={3}>Perdida</option>
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
