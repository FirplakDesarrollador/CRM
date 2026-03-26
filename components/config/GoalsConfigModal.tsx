"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Save, AlertCircle, CheckCircle2, Target, BarChart, Users, DollarSign } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface GoalsConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialUserId?: string;
}

interface UserOption {
    id: string;
    full_name: string;
    email: string;
}

interface OpportunityOption {
    id: string;
    nombre: string;
    account_name?: string;
}

const GOAL_TYPES = [
    { id: 'SPECIFIC_OPPORTUNITY', label: 'Cerrar Oportunidad Específica', icon: Target },
    { id: 'WON_COUNT', label: 'Meta de Ventas Ganadas', icon: DollarSign },
    { id: 'CONTACT_COUNT', label: 'Meta de Nuevos Contactos', icon: Users },
    { id: 'TOTAL_OPPORTUNITIES', label: 'Meta de Oportunidades Totales', icon: BarChart },
];

export function GoalsConfigModal({ isOpen, onClose, initialUserId }: GoalsConfigModalProps) {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form Stats
    const [selectedUserId, setSelectedUserId] = useState("");
    const [goalType, setGoalType] = useState("SPECIFIC_OPPORTUNITY");
    const [targetValue, setTargetValue] = useState("");
    const [selectedOppId, setSelectedOppId] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [status, setStatus] = useState("En Proceso");

    useEffect(() => {
        if (isOpen) {
            fetchData();
            // Reset form
            setSelectedUserId(initialUserId || "");
            setGoalType("SPECIFIC_OPPORTUNITY");
            setTargetValue("");
            setSelectedOppId("");
            setDescription("");
            setDueDate("");
            setStatus("En Proceso");
            setError(null);
            setSuccess(null);
        }
    }, [isOpen, initialUserId]);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch Users
            const { data: userData, error: userError } = await supabase
                .from('CRM_Usuarios')
                .select('id, full_name, email')
                .eq('is_active', true)
                .order('full_name');

            if (userError) throw userError;
            setUsers(userData || []);

            // Fetch Opportunities
            const { data: oppData, error: oppError } = await supabase
                .from('CRM_Oportunidades')
                .select('id, nombre, account_id')
                .not('estado_id', 'in', '(4,5)')
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(100);

            if (oppError) throw oppError;
            setOpportunities(oppData || []);

        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(err.message || "Error cargando datos");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedUserId) {
            setError("Debes seleccionar un usuario");
            return;
        }

        if (goalType === 'SPECIFIC_OPPORTUNITY' && !selectedOppId) {
            setError("Debes seleccionar una oportunidad");
            return;
        }

        if (goalType !== 'SPECIFIC_OPPORTUNITY' && (!targetValue || parseInt(targetValue) <= 0)) {
            setError("Debes ingresar un valor objetivo mayor a 0");
            return;
        }

        if (!description) {
            // Auto-generate description if empty
            if (goalType === 'WON_COUNT') setDescription(`Cerrar ${targetValue} ventas`);
            else if (goalType === 'CONTACT_COUNT') setDescription(`Conseguir ${targetValue} nuevos contactos`);
            else if (goalType === 'TOTAL_OPPORTUNITIES') setDescription(`Crear ${targetValue} nuevas oportunidades`);
            else {
                setError("Debes ingresar una descripción");
                return;
            }
        }

        setIsSaving(true);
        setError(null);

        try {
            const { error: saveError } = await supabase
                .from('CRM_Metas')
                .insert({
                    user_id: selectedUserId,
                    goal_type: goalType,
                    target_value: targetValue ? parseInt(targetValue) : 0,
                    opportunity_id: goalType === 'SPECIFIC_OPPORTUNITY' ? selectedOppId : null,
                    description: description,
                    due_date: dueDate || null,
                    status: status,
                    created_by: (await supabase.auth.getUser()).data.user?.id
                });

            if (saveError) {
                console.error("Supabase Error:", saveError);
                throw saveError;
            }

            setSuccess("Meta creada exitosamente");
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err: any) {
            console.error("Error saving goal:", err);
            // Construct a more detailed error message if possible
            const errorMsg = err.message || "Error guardando la meta";
            const errorDetails = err.details ? ` (${err.details})` : "";
            setError(`${errorMsg}${errorDetails}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Configurar Meta</h3>
                            <p className="text-xs text-slate-500">Asignar nueva meta a usuario</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* User Select */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Usuario Responsable <span className="text-red-500">*</span></label>
                        <select
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            disabled={isLoading}
                        >
                            <option value="">Seleccionar Usuario...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.full_name || u.email}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Goal Type Select */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo de Meta</label>
                        <div className="grid grid-cols-1 gap-2">
                            {GOAL_TYPES.map((type) => (
                                <div
                                    key={type.id}
                                    onClick={() => setGoalType(type.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                        goalType === type.id
                                            ? "bg-blue-50 border-blue-200 ring-1 ring-blue-500/20"
                                            : "bg-white border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg",
                                        goalType === type.id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                        <type.icon className="w-4 h-4" />
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium",
                                        goalType === type.id ? "text-blue-900" : "text-slate-600"
                                    )}>
                                        {type.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        {goalType === 'SPECIFIC_OPPORTUNITY' ? (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Oportunidad Objetivo <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={selectedOppId}
                                    onChange={(e) => setSelectedOppId(e.target.value)}
                                    disabled={isLoading}
                                >
                                    <option value="">Seleccionar Oportunidad...</option>
                                    {opportunities.map(o => (
                                        <option key={o.id} value={o.id}>
                                            {o.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Cantidad Objetivo <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="Ej: 5"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Descripción (Opcional)</label>
                        <textarea
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                            placeholder={goalType !== 'SPECIFIC_OPPORTUNITY' ? `Generada automáticamente: "Conseguir ${targetValue || 'X'}..."` : "Detalles adicionales..."}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Due Date */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Fecha de Vencimiento <span className="text-slate-400 font-normal">(Opcional)</span></label>
                        <input
                            type="date"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Estado Inicial</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['En Proceso', 'Terminado', 'Fracasada'].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStatus(s)}
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-xs font-bold border transition-all",
                                        status === s
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Guardar Meta
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
