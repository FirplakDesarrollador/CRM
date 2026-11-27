"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { isB2COpportunity } from "@/lib/b2c";
import { toInputDate } from "@/lib/date-utils";
import { X, TrendingUp, Calendar, Hash, Percent } from "lucide-react";
import { ProbabilityDonut } from "@/components/ui/ProbabilityDonut";
import { formatNumberCO } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { estadoIdForPhaseName, getPhaseOutcomeByName, isClosedPhaseName } from "@/lib/opportunityPhase";
import { resolveStepperPhaseId, selectPhasesForPicker, type PhaseCatalogItem } from "@/lib/opportunityPhaseCatalog";

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
    const [phaseId, setPhaseId] = useState<number | null>(null);
    const [phaseTouched, setPhaseTouched] = useState(false);
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
                    .select('id, nombre, orden, probability, canal_id, is_active')
                    .eq('canal_id', canalId)
                    .eq('is_active', true)
                    .order('orden')
                    .returns<PhaseOption[]>();

                if (phasesError) throw phasesError;
                channelPhases = selectPhasesForPicker(phases || [], canalId);
            }

            let displayedPhaseId = opp.fase_id ?? null;
            if (opp.fase_id && !channelPhases.some(phase => Number(phase.id) === Number(opp.fase_id))) {
                const { data: currentPhase } = await supabase
                    .from('CRM_FasesOportunidad')
                    .select('id, nombre, orden, probability, canal_id, is_active')
                    .eq('id', opp.fase_id)
                    .maybeSingle();
                const catalog = currentPhase ? [...channelPhases, currentPhase as PhaseCatalogItem] : channelPhases;
                displayedPhaseId = resolveStepperPhaseId(opp.fase_id, catalog, canalId);
            }

            // Map the probability from the joined phase if the opportunity probability is missing/zero
            const probability = opp.probability || opp.fase_detail?.probability || 0;
            setOpportunity({ ...opp, probability });
            setPhaseId(displayedPhaseId);
            setPhaseTouched(false);
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

    const handleSave = async () => {
        if (!phaseTouched) {
            onClose();
            return;
        }
        setIsSaving(true);
        try {
            const targetPhase = phaseOptions.find(phase => phase.id === phaseId);
            // El resultado (abierta / ganada / perdida) sale SOLO de la fase.
            const isClosed = Boolean(targetPhase && isClosedPhaseName(targetPhase.nombre));
            const updates: any = {
                fase_id: phaseId,
                probability: targetPhase?.probability ?? opportunity?.probability,
                updated_at: new Date().toISOString()
            };
            // estado_id se sigue guardando por dentro (1/2/3 según la fase) para comisiones e integraciones.
            if (targetPhase) updates.estado_id = estadoIdForPhaseName(targetPhase.nombre);

            const isB2C = isB2COpportunity(opportunity?.account, opportunity, null, targetPhase);
            if (isClosed && isB2C) {
                updates.fecha_cierre_estimada = toInputDate(new Date());
            }

            const { error } = await supabase
                .from('CRM_Oportunidades')
                .update(updates)
                .eq('id', opportunityId);

            if (error) throw error;

            try {
                await db.opportunities.update(opportunityId, updates);
            } catch (dexieErr) {
                console.warn('[OpportunityQuickView] Dexie update warning:', dexieErr);
            }

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
                                        $ {formatNumberCO(opportunity?.amount)} {opportunity?.currency_id || 'COP'}
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

                            {/* Fase (el resultado abierta / ganada / perdida sale de la fase) */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Fase</label>
                                <SearchableSelect
                                    value={phaseId != null ? String(phaseId) : ""}
                                    onChange={(val) => {
                                        setPhaseTouched(true);
                                        setPhaseId(val ? parseInt(val, 10) : null);
                                    }}
                                    disabled={phaseOptions.length === 0}
                                    allowClear={false}
                                    placeholder="Sin fase"
                                    searchPlaceholder="Buscar fase..."
                                    triggerClassName="rounded-xl border-slate-200 bg-slate-50 font-medium text-slate-900"
                                    options={phaseOptions.map(phase => {
                                        // Cerrar como perdida exige razón y comentarios: se hace desde el detalle.
                                        const lockLost = getPhaseOutcomeByName(phase.nombre) === 'lost' && phase.id !== opportunity?.fase_id;
                                        return {
                                            value: String(phase.id),
                                            label: `${phase.nombre}${lockLost ? ' (desde el detalle)' : ''}`,
                                            disabled: lockLost,
                                        };
                                    })}
                                />
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
