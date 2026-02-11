"use client";

import { useOpportunities, useQuotes, useQuoteItems } from "@/lib/hooks/useOpportunities";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Plus, AlertCircle, Check, Trash2, Loader2, Truck, Package, Building, ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { ProbabilityDonut } from "@/components/ui/ProbabilityDonut";
import { syncEngine } from "@/lib/sync";
import { useLiveQuery } from "dexie-react-hooks";
import { formatColombiaDate, isDateOverdue, toInputDate, parseColombiaDate } from "@/lib/date-utils";
import {
    Calendar as CalendarIcon,
    CheckCircle2,
    Circle,
    Clock,
    ListTodo,
    Search as SearchIcon
} from "lucide-react";
import { useActivities, LocalActivity } from "@/lib/hooks/useActivities";
import { CreateActivityModal } from "@/components/activities/CreateActivityModal";
import { supabase } from "@/lib/supabase";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useSyncStore } from "@/lib/stores/useSyncStore";
import { LossReasonModal } from "@/components/oportunidades/LossReasonModal";
import { CollaboratorsTab } from "@/components/oportunidades/CollaboratorsTab";
import { DollarSign } from "lucide-react";

export default function OpportunityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { opportunities, deleteOpportunity } = useOpportunities();
    const { userRole } = useSyncStore();

    const phases = useLiveQuery(() => db.phases.toArray());
    const phaseMap = new Map(phases?.map(p => [p.id, p.nombre]));

    const opportunity = opportunities?.find(o => o.id === id);
    const [serverOpportunity, setServerOpportunity] = useState<any>(null);
    const [isFetchingServer, setIsFetchingServer] = useState(false);

    // Fallback: If not found locally, try to fetch from server (JIT Sync)
    useEffect(() => {
        const fetchFromServer = async () => {
            if (opportunities && !opportunity && !isFetchingServer && !serverOpportunity) {
                console.log(`[JIT Sync] Opportunity ${id} not found locally. Fetching from server...`);
                setIsFetchingServer(true);
                try {
                    // Fetch Opportunity
                    const { data: oppData, error: oppError } = await supabase
                        .from('CRM_Oportunidades')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (oppData && !oppError) {
                        console.log(`[JIT Sync] Found opportunity on server. Saving locally...`);
                        await db.opportunities.put(oppData);

                        // Fetch Collaborators (Defensive)
                        try {
                            const { data: collabs, error: collabsError } = await supabase
                                .from('CRM_Oportunidades_Colaboradores')
                                .select('*')
                                .eq('oportunidad_id', id);

                            if (collabs && !collabsError) {
                                await db.opportunityCollaborators.bulkPut(collabs);
                            }
                        } catch (err) {
                            console.warn("Could not fetch collaborators from server (table might be missing):", err);
                        }

                    } else if (oppError) {
                        console.warn(`[JIT Sync] Opportunity not found on server either:`, oppError.message);
                        setServerOpportunity('NOT_FOUND');
                    }
                } catch (err) {
                    console.error(`[JIT Sync] Error fetching opportunity:`, err);
                } finally {
                    setIsFetchingServer(false);
                }
            }
        };

        fetchFromServer();
    }, [id, opportunity, opportunities, isFetchingServer, serverOpportunity]);

    const [activeTab, setActiveTab] = useState<'resumen' | 'colaboradores' | 'cotizaciones' | 'productos' | 'actividades'>('resumen');

    // Modal state for delete confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteOpportunity(id);
            setIsDeleteModalOpen(false); // Close modal before navigation
            router.push("/oportunidades");
        } catch (error) {
            console.error("Error deleting opportunity:", error);
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    if (isFetchingServer) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-slate-500 font-medium">Buscando en el servidor...</p>
            </div>
        );
    }

    if (!opportunity) {
        if (serverOpportunity === 'NOT_FOUND') {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
                    <AlertCircle className="w-12 h-12 text-slate-300" />
                    <p className="text-slate-500 font-medium text-lg">Oportunidad no encontrada</p>
                    <button onClick={() => router.push("/oportunidades")} className="text-blue-600 font-bold hover:underline">
                        Volver al listado
                    </button>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                    <p className="text-slate-400">Cargando oportunidad...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <DetailHeader
                title={opportunity.nombre}
                subtitle={`${opportunity.currency_id} ${opportunity.amount}`}
                status={
                    opportunity.estado_id === 2 ? 'Ganada' :
                        opportunity.estado_id === 3 ? 'Perdida' :
                            opportunity.estado_id === 4 ? 'Cancelada' :
                                (phaseMap.get(opportunity.fase_id) || opportunity.fase || 'Prospecto')
                }
                backHref="/oportunidades"
                actions={[
                    ...(userRole === 'ADMIN' || userRole === 'COORDINATOR' ? [{
                        label: "Eliminar Oportunidad",
                        icon: Trash2,
                        variant: 'danger' as const,
                        onClick: () => setIsDeleteModalOpen(true)
                    }] : [])
                ]}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

                {/* Sub-Tabs Nav */}
                <div className="flex space-x-6 border-b border-slate-200 mb-6">
                    {['resumen', 'colaboradores', 'cotizaciones', 'productos', 'actividades'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={cn(
                                "pb-3 text-sm font-medium border-b-2 capitalize transition-colors",
                                activeTab === tab
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-slate-500 hover:text-slate-800"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {activeTab === 'cotizaciones' && (
                    <QuotesTab opportunityId={id} currency={opportunity.currency_id || 'COP'} />
                )}

                {activeTab === 'colaboradores' && (
                    <CollaboratorsTab opportunityId={id} />
                )}

                {activeTab === 'productos' && (
                    <ProductsTab opportunityId={id} />
                )}

                {activeTab === 'resumen' && (
                    <SummaryTab opportunity={opportunity} />
                )}

                {activeTab === 'actividades' && (
                    <ActivitiesTab opportunityId={id} />
                )}
            </div>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Eliminar Oportunidad"
                message="¿Estás seguro de que deseas eliminar esta oportunidad? Esta acción no se puede deshacer."
                confirmLabel="Eliminar Oportunidad"
                variant="danger"
                isLoading={isDeleting}
            />

        </div>
    );
}

function SummaryTab({ opportunity }: { opportunity: any }) {
    const { updateOpportunity } = useOpportunities();
    const { quotes } = useQuotes(opportunity.id);
    const [localAmount, setLocalAmount] = useState(opportunity.amount || 0);
    const [localClosingDate, setLocalClosingDate] = useState(toInputDate(opportunity.fecha_cierre_estimada));
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDate, setIsSavingDate] = useState(false);

    // Filter Logic
    const [isLossReasonModalOpen, setIsLossReasonModalOpen] = useState(false);
    const [pendingPhaseId, setPendingPhaseId] = useState<number | null>(null);

    // Segments Logic
    const [segments, setSegments] = useState<any[]>([]);
    const [localSegmentId, setLocalSegmentId] = useState<string>(opportunity.segmento_id ? String(opportunity.segmento_id) : "");
    const [isSavingSegment, setIsSavingSegment] = useState(false);

    // Sync local state when prop updates
    useEffect(() => {
        setLocalSegmentId(opportunity.segmento_id ? String(opportunity.segmento_id) : "");
        setLocalClosingDate(toInputDate(opportunity.fecha_cierre_estimada));
    }, [opportunity.segmento_id, opportunity.fecha_cierre_estimada]);

    useEffect(() => {
        const fetchSegments = async () => {
            const { data } = await supabase.from('CRM_Segmentos').select('*');
            if (data) setSegments(data);
        };
        fetchSegments();
    }, []);

    const handleSegmentChange = async (newId: string) => {
        setLocalSegmentId(newId);
        setIsSavingSegment(true);
        try {
            await updateOpportunity(opportunity.id, { segmento_id: newId ? Number(newId) : null });
        } finally {
            setIsSavingSegment(false);
        }
    };


    // Fetch Account
    const account = useLiveQuery(
        () => db.accounts.get(opportunity.account_id),
        [opportunity.account_id]
    );

    const [isFetchingAccount, setIsFetchingAccount] = useState(false);

    // Rollback for Account (JIT Sync)
    useEffect(() => {
        const fetchAccountFromServer = async () => {
            if (opportunity.account_id && !account && !isFetchingAccount && navigator.onLine) {
                console.log(`[JIT Sync] Account ${opportunity.account_id} not found locally. Fetching from server...`);
                setIsFetchingAccount(true);
                try {
                    const { data, error } = await supabase
                        .from('CRM_Cuentas')
                        .select('*')
                        .eq('id', opportunity.account_id)
                        .single();

                    if (data && !error) {
                        console.log(`[JIT Sync] Found account on server. Saving locally...`);
                        await db.accounts.put(data);
                    }
                } catch (err) {
                    console.error("Error fetching account from server", err);
                } finally {
                    setIsFetchingAccount(false);
                }
            }
        };
        fetchAccountFromServer();
    }, [opportunity.account_id, account, isFetchingAccount]);

    // Fetch Phases for Channel
    const phases = useLiveQuery(
        () => account?.canal_id
            ? db.phases.where('canal_id').equals(account.canal_id).sortBy('orden')
            : [],
        [account?.canal_id]
    );

    const handlePhaseChange = async (phaseId: number) => {
        const targetPhase = phases?.find(p => p.id === phaseId);

        // Check if target is "Cerrada Perdida"
        const normalizedName = targetPhase?.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

        if (normalizedName.includes('perdida')) {
            setPendingPhaseId(phaseId);
            setIsLossReasonModalOpen(true);
            return;
        }

        // Check if target is "Cerrada Ganada"
        if (normalizedName.includes('ganada')) {
            await updateOpportunity(opportunity.id, {
                fase_id: phaseId,
                estado_id: 2 // Explicitly set to Won status
            });
            return;
        }

        // Default: just update phase, reset estado to Open if coming from a closed state
        await updateOpportunity(opportunity.id, {
            fase_id: phaseId,
            estado_id: 1 // Reset to Open status when moving to any other phase
        });
    };

    const confirmLossReason = async (reasonId: number) => {
        if (pendingPhaseId) {
            await updateOpportunity(opportunity.id, {
                fase_id: pendingPhaseId,
                razon_perdida_id: reasonId,
                estado_id: 3 // Explicitly set to Lost status ID (usually 3)
            });
            setIsLossReasonModalOpen(false);
            setPendingPhaseId(null);
        }
    };

    if (!account) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Cargando datos del cliente...</p>
                {isFetchingAccount && <p className="text-xs text-slate-400 mt-1">Buscando en el servidor...</p>}
            </div>
        );
    }

    const currentPhaseIndex = phases?.findIndex(p => p.id === opportunity.fase_id) ?? -1;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Timeline Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <h3 className="font-bold text-slate-900 mb-10">Fases de Venta</h3>

                {!phases || phases.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">
                        No hay fases definidas para el canal {account.canal_id || 'seleccionado'}.
                    </div>
                ) : (
                    <div className="overflow-x-auto pb-16">
                        <div className="relative pt-16 min-w-[800px] px-2">
                            {/* Connecting Line - Extends to the start of the bifurcation */}
                            <div
                                className="absolute top-19 left-0 h-1 bg-slate-100 rounded-full z-0"
                                style={{ width: 'calc(100% - 292px)' }}
                            />

                            <div className="flex justify-between items-start relative z-10 w-full">
                                {phases.map((phase, index) => {
                                    const normalizedPhaseName = phase.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                    const isFinal = normalizedPhaseName.includes('cerrada') || normalizedPhaseName.includes('ganada') || normalizedPhaseName.includes('perdida');
                                    if (isFinal) return null; // Skip final phases in main loop

                                    const isCompleted = currentPhaseIndex > index;
                                    const isCurrent = currentPhaseIndex === index;
                                    const isPending = currentPhaseIndex < index;

                                    return (
                                        <button
                                            key={phase.id}
                                            onClick={() => handlePhaseChange(phase.id)}
                                            className="flex flex-col items-center group w-24 focus:outline-none relative z-10"
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-300",
                                                isCompleted ? "bg-blue-600 border-blue-600 text-white" :
                                                    isCurrent ? "bg-white border-blue-600 scale-125 shadow-md" :
                                                        "bg-white border-slate-200 text-slate-300 group-hover:border-blue-200"
                                            )}>
                                                {isCompleted && <Check className="w-4 h-4" />}
                                                {isCurrent && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />}
                                                {isPending && <span className="text-[10px] font-bold text-slate-400">{index + 1}</span>}
                                            </div>
                                            <span className={cn(
                                                "mt-3 text-[10px] font-bold text-center uppercase tracking-wide transition-colors duration-300",
                                                isCurrent ? "text-blue-700" :
                                                    isCompleted ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                                            )}>
                                                {phase.nombre}
                                            </span>
                                        </button>
                                    );
                                })}

                                {/* Bifurcation for Final Phases */}
                                <div className="relative h-28 w-[292px] shrink-0" style={{ marginTop: '-34px' }}>
                                    {/* Curved SVG Lines for Bifurcation */}
                                    <svg className="absolute left-0 top-0 w-full h-full pointer-events-none z-0">
                                        {/* Main path splitting - Y=48 aligns with horizontal line (top-19 = 76px, container at 64px - 32px margin = 32px, so 76-32=44 → use 48 for visual alignment) */}
                                        <path
                                            d="M 0 48 C 30 48, 50 16, 90 16"
                                            fill="none"
                                            stroke="#f1f5f9"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                        />
                                        <path
                                            d="M 0 48 C 30 48, 50 96, 90 96"
                                            fill="none"
                                            stroke="#f1f5f9"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                        />
                                    </svg>

                                    {phases.filter(p => {
                                        const normalized = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                        return normalized.includes('cerrada') || normalized.includes('ganada') || normalized.includes('perdida');
                                    }).map((phase) => {
                                        const isWon = phase.nombre.toLowerCase().includes('ganada');
                                        const isActive = opportunity.fase_id === phase.id;

                                        return (
                                            <button
                                                key={phase.id}
                                                onClick={() => handlePhaseChange(phase.id)}
                                                // Align buttons with the ends of the SVG paths (Y=16 and Y=96)
                                                style={{ top: isWon ? '16px' : '96px', transform: 'translateY(-50%)' }}
                                                className={cn(
                                                    "absolute left-[88px] flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all z-10 whitespace-nowrap",
                                                    isActive
                                                        ? (isWon ? "bg-green-100 text-green-700 border-green-200 shadow-sm ring-2 ring-green-500/20" : "bg-red-100 text-red-700 border-red-200 shadow-sm ring-2 ring-red-500/20")
                                                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    isWon ? "bg-green-500" : "bg-red-500"
                                                )} />
                                                {phase.nombre}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Commission Badge - Only shown for Won opportunities */}
            {opportunity.estado_id === 2 && (
                <CommissionBadge opportunityId={opportunity.id} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Business Info Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Información de Negocio</h3>
                            <p className="text-xs text-slate-500">Valor y métricas financieras</p>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        {/* Probability Donut - Added */}
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                            <div>
                                <h4 className="font-bold text-slate-700 text-sm">Probabilidad de Éxito</h4>
                                <p className="text-xs text-slate-400 mt-1">Calculado según fase actual</p>
                            </div>
                            <ProbabilityDonut
                                percentage={
                                    opportunity.estado_id === 2 ? 100 : // Cerrada Ganada = 100%
                                        opportunity.estado_id === 3 ? 0 :   // Cerrada Perdida = 0%
                                            opportunity?.probability || (opportunity?.fase_id ? phases?.find(p => p.id === opportunity.fase_id)?.probability : 0) || 0
                                }
                                size={64}
                                strokeWidth={6}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Valor de la Oportunidad (Importe)
                            </label>
                            {(!quotes || quotes.length === 0) ? (
                                <div className="space-y-2">
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={localAmount}
                                            onChange={(e) => setLocalAmount(Number(e.target.value))}
                                            onBlur={async () => {
                                                if (localAmount !== opportunity.amount) {
                                                    setIsSaving(true);
                                                    await updateOpportunity(opportunity.id, { amount: localAmount });
                                                    setIsSaving(false);
                                                }
                                            }}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                            placeholder="Ingrese el valor estimado"
                                        />
                                        {isSaving && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        No hay cotizaciones activas. Puede editar este valor manualmente.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                        <div className="text-xl font-bold text-blue-700 flex items-center gap-1.5">
                                            <span className="text-blue-500 font-medium">$</span>
                                            {new Intl.NumberFormat().format(opportunity.amount || 0)}
                                            <span className="ml-1 text-xs font-medium text-blue-500">{opportunity.currency_id}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                        Valor vinculado a cotización activa
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Cierre Estimada</label>
                                <div className="relative group">
                                    <input
                                        type="date"
                                        value={localClosingDate}
                                        onChange={(e) => setLocalClosingDate(e.target.value)}
                                        onBlur={async () => {
                                            if (localClosingDate !== opportunity.fecha_cierre_estimada) {
                                                setIsSavingDate(true);
                                                await updateOpportunity(opportunity.id, { fecha_cierre_estimada: localClosingDate ? localClosingDate : null });
                                                setIsSavingDate(false);
                                            }
                                        }}
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                    />
                                    {isSavingDate && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Moneda</label>
                                <div className="px-3 py-1.5 bg-slate-50 rounded-lg text-slate-700 font-bold text-sm">
                                    {opportunity.currency_id}
                                </div>
                            </div>
                        </div>

                        {/* SEGMENTO SELECTOR */}
                        <div className="pt-4 border-t border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Segmento (Subclasificación)
                            </label>
                            <div className="relative group">
                                <select
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50"
                                    value={localSegmentId}
                                    onChange={(e) => handleSegmentChange(e.target.value)}
                                    disabled={!account.subclasificacion_id || segments.length === 0}
                                >
                                    <option value="">Seleccione un segmento...</option>
                                    {segments
                                        .filter(seg => account.subclasificacion_id && seg.subclasificacion_id === Number(account.subclasificacion_id))
                                        .map(seg => (
                                            <option key={seg.id} value={String(seg.id)}>
                                                {seg.nombre}
                                            </option>
                                        ))
                                    }
                                </select>
                                {isSavingSegment && (
                                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                                    </div>
                                )}
                                {!account.subclasificacion_id && (
                                    <p className="text-[10px] text-orange-500 mt-1">
                                        La cuenta no tiene subclasificación. Edite la cuenta para habilitar segmentos.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado</label>
                            <div className={cn(
                                "px-3 py-1.5 rounded-lg font-bold text-sm border",
                                opportunity.estado_id === 2 ? "bg-green-50 text-green-700 border-green-100" :
                                    opportunity.estado_id === 3 ? "bg-red-50 text-red-700 border-red-100" :
                                        opportunity.estado_id === 4 ? "bg-slate-50 text-slate-700 border-slate-200" :
                                            "bg-blue-50 text-blue-700 border-blue-100"
                            )}>
                                {opportunity.status || (
                                    opportunity.estado_id === 1 ? 'Abierta' :
                                        opportunity.estado_id === 2 ? 'Ganada' :
                                            opportunity.estado_id === 3 ? 'Perdida' :
                                                opportunity.estado_id === 4 ? 'Cancelada' : 'Abierta'
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Account Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Building className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">Información del Cliente</h3>
                            <p className="text-xs text-slate-500">Datos principales de la cuenta</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre / Razón Social</label>
                            <p className="text-slate-900 font-medium">{account.nombre}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIT</label>
                                <p className="text-slate-700">{account.nit || 'No registrado'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teléfono</label>
                                <p className="text-slate-700">{account.telefono || 'No registrado'}</p>
                            </div>
                        </div>
                        {account.direccion && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dirección</label>
                                <p className="text-slate-700">{account.direccion} {account.ciudad && `• ${account.ciudad}`}</p>
                            </div>
                        )}
                    </div>
                </div>

                <Link
                    href={`/cuentas?id=${account.id}`}
                    className="mt-6 w-full py-2 bg-slate-50 hover:bg-blue-50 text-blue-600 text-sm font-bold rounded-xl border border-slate-100 hover:border-blue-200 text-center transition-all flex items-center justify-center gap-2"
                >
                    Ver detalles en Cuentas <ChevronRight className="w-4 h-4" />
                </Link>
            </div>

            <LossReasonModal
                isOpen={isLossReasonModalOpen}
                onClose={() => {
                    setIsLossReasonModalOpen(false);
                    setPendingPhaseId(null);
                }}
                onConfirm={confirmLossReason}
            />
        </div>
    );
}

function ProductsTab({ opportunityId }: { opportunityId: string }) {
    const { opportunities } = useOpportunities();
    const opportunity = opportunities?.find(o => o.id === opportunityId);
    const { quotes } = useQuotes(opportunityId);

    // 1. Determine "Active" quote (Winner or Latest)
    const sortedQuotes = [...(quotes || [])].sort((a, b) =>
        new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    const defaultQuote = sortedQuotes.find(q => q.status === 'WINNER') || sortedQuotes[0];

    // 2. State for User Selection
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

    // Sync state with default if not yet selected
    const effectiveQuote = selectedQuoteId
        ? quotes?.find(q => q.id === selectedQuoteId)
        : defaultQuote;

    const { items: quoteItems } = useQuoteItems(effectiveQuote?.id);
    const { updateOpportunity } = useOpportunities();

    const itemsToShow = (quoteItems && quoteItems.length > 0)
        ? quoteItems
        : (opportunity?.items || []);

    // Effect: Synchronize opportunity amount with effective quote whenever quote changes
    useEffect(() => {
        if (effectiveQuote && opportunity && effectiveQuote.total_amount !== opportunity.amount) {
            updateOpportunity(opportunityId, { amount: effectiveQuote.total_amount });
        }
    }, [effectiveQuote?.id, effectiveQuote?.total_amount, opportunity?.id, opportunity?.amount]);

    if (!effectiveQuote && itemsToShow.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400">
                No hay productos asociados. Agregue productos en el asistente o cree una cotización.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 leading-tight">
                            Productos
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">Viendo cotización:</span>
                            {/* Quote Selector Dropdown */}
                            {quotes && quotes.length > 0 ? (
                                <select
                                    className="text-xs font-bold text-blue-600 bg-blue-50 border-none rounded-md py-1 pl-2 pr-8 cursor-pointer focus:ring-2 focus:ring-blue-500"
                                    value={effectiveQuote?.id || ''}
                                    onChange={(e) => {
                                        const qId = e.target.value;
                                        setSelectedQuoteId(qId);
                                        const selected = quotes?.find(q => q.id === qId);
                                        if (selected && opportunity) {
                                            updateOpportunity(opportunityId, { amount: selected.total_amount });
                                        }
                                    }}
                                >
                                    {sortedQuotes.map(q => (
                                        <option key={q.id} value={q.id}>
                                            {q.numero_cotizacion} {q.status === 'WINNER' ? '(Ganadora)' : ''} - {new Date(q.updated_at || 0).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="text-xs text-slate-400 font-medium">Borrador Original</span>
                            )}
                        </div>
                    </div>
                </div>

                {effectiveQuote && (
                    <Link
                        href={`/oportunidades/${opportunityId}/cotizaciones/${effectiveQuote.id}`}
                        className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        Editar en Cotizador
                    </Link>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                        <tr>
                            <th className="px-4 py-3">Descripción</th>
                            <th className="px-4 py-3 text-center">Cant.</th>
                            <th className="px-4 py-3 text-right">Unitario</th>
                            <th className="px-4 py-3 text-center">Dcto. %</th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {itemsToShow.map((item: any) => {
                            const unitPrice = item.precio_unitario || item.precio || 0;
                            const discount = item.discount_pct || 0;
                            const effectiveSubtotal = item.subtotal || (item.cantidad * unitPrice * (1 - discount / 100));

                            return (
                                <tr key={item.id || item.product_id}>
                                    <td className="px-4 py-3 font-medium text-slate-900 min-w-[300px] max-w-sm">
                                        <div className="line-clamp-2 leading-tight">
                                            {item.descripcion_linea || item.nombre}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600">{item.cantidad}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">
                                        ${new Intl.NumberFormat().format(unitPrice)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600 font-medium">
                                        {discount > 0 ? (
                                            <span className="text-emerald-600">-{discount}%</span>
                                        ) : (
                                            <span className="text-slate-400">0%</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                        ${new Intl.NumberFormat().format(effectiveSubtotal)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                            <td colSpan={4} className="px-4 py-3 text-right text-slate-500">Total</td>
                            <td className="px-4 py-3 text-right text-blue-600 text-lg">
                                ${new Intl.NumberFormat().format(
                                    itemsToShow.reduce((acc: number, item: any) =>
                                        acc + (item.subtotal || (item.cantidad * (item.precio_unitario || item.precio || 0) * (1 - (item.discount_pct || 0) / 100))), 0
                                    )
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

function QuotesTab({ opportunityId, currency }: { opportunityId: string, currency: string }) {
    const { quotes, createQuote, markAsWinner, deleteQuote } = useQuotes(opportunityId);
    const [isCreating, setIsCreating] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Modal State
    const [modalAction, setModalAction] = useState<{ type: 'GENERATE' | 'DELETE', data: any } | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            const newId = await createQuote(opportunityId, { currency_id: currency });
            window.location.href = `/oportunidades/${opportunityId}/cotizaciones/${newId}`;
        } catch (e) {
            console.error(e);
            setIsCreating(false);
        }
    };

    const handleMarkWinner = (quote: any) => {
        setModalAction({ type: 'GENERATE', data: quote });
    };

    const handleDelete = (quote: any) => {
        setModalAction({ type: 'DELETE', data: quote });
    };

    const executeAction = async () => {
        if (!modalAction) return;
        setIsActionLoading(true);
        try {
            if (modalAction.type === 'GENERATE') {
                setProcessingId(modalAction.data.id);
                // @ts-ignore
                await markAsWinner(modalAction.data.id);
            } else if (modalAction.type === 'DELETE') {
                await deleteQuote(modalAction.data.id);
            }
            setModalAction(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsActionLoading(false);
            setProcessingId(null);
        }
    };

    const checkSapReady = (q: any) => {
        // Validation logic matching SapDataEditor
        return q.fecha_facturacion && q.tipo_facturacion && q.orden_compra;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h3 className="font-bold text-blue-900">Cotizaciones</h3>
                    <p className="text-sm text-blue-700">Gestiona las propuestas comerciales para este negocio.</p>
                </div>
                <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {isCreating ? "Creando..." : "Nueva Cotización"}
                </button>
            </div>

            {(!quotes || quotes.length === 0) ? (
                <div className="text-center py-12 text-slate-400">
                    No hay cotizaciones aún. Crea la primera.
                </div>
            ) : (
                <div className="grid gap-4">
                    {[...quotes].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()).map(q => {
                        const isReady = checkSapReady(q);
                        const isProcessing = processingId === q.id;

                        return (
                            <div key={q.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 flex justify-between group relative overflow-hidden">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleDelete(q);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all z-10 opacitiy-0 group-hover:opacity-100"
                                    title="Eliminar Cotización"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                <Link href={`/oportunidades/${opportunityId}/cotizaciones/${q.id}`} className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-bold text-slate-800 hover:text-blue-600 transition-colors">{q.numero_cotizacion}</h4>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                            q.status === 'WINNER' ? "bg-green-100 text-green-700" :
                                                q.status === 'REJECTED' ? "bg-red-100 text-red-700" :
                                                    "bg-slate-100 text-slate-600"
                                        )}>
                                            {q.status === 'WINNER' ? 'Ganada / Pedido' : q.status}
                                        </span>
                                        {q.is_winner && <Check className="w-4 h-4 text-green-600" />}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Creada el {formatColombiaDate(q.updated_at || new Date(), "dd/MM/yyyy")}
                                    </p>
                                </Link>

                                <div className="text-right flex flex-col items-end gap-2 pr-6">
                                    <p className="font-bold text-slate-900 text-lg">
                                        {q.currency_id} {new Intl.NumberFormat().format(q.total_amount || 0)}
                                    </p>

                                    {q.status !== 'WINNER' && q.status !== 'REJECTED' && (
                                        <div className="flex items-center gap-2">
                                            {isReady ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleMarkWinner(q);
                                                    }}
                                                    disabled={isProcessing}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                                                >
                                                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                                                    Generar Pedido
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[10px] text-orange-500 bg-orange-50 px-2 py-1 rounded-md" title="Complete los campos en la pestaña Datos SAP">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Incompleta para SAP
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmationModal
                isOpen={!!modalAction}
                onClose={() => setModalAction(null)}
                onConfirm={executeAction}
                title={modalAction?.type === 'GENERATE' ? "Generar Pedido" : "Eliminar Cotización"}
                message={modalAction?.type === 'GENERATE'
                    ? `¿Confirmas que deseas generar el pedido para la cotización ${modalAction.data.numero_cotizacion}? Esto cerrará las demás cotizaciones.`
                    : `¿Confirmas que deseas eliminar la cotización ${modalAction?.data.numero_cotizacion}? Esta acción no se puede deshacer.`}
                confirmLabel={modalAction?.type === 'GENERATE' ? "Generar Pedido" : "Eliminar"}
                variant={modalAction?.type === 'GENERATE' ? 'info' : 'danger'}
                isLoading={isActionLoading}
            />
        </div>
    );
}

function ActivitiesTab({ opportunityId }: { opportunityId: string }) {
    const { activities, createActivity, updateActivity, toggleComplete } = useActivities(opportunityId);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<LocalActivity | null>(null);
    const { opportunities } = useOpportunities();

    const sortedActivities = activities?.sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());

    // Catalogs
    const classifications = useLiveQuery(() => db.activityClassifications.toArray(), []) || [];
    const subclassifications = useLiveQuery(() => db.activitySubclassifications.toArray(), []) || [];

    // PROACTIVE SYNC: If catalogs are empty, trigger a pull
    useEffect(() => {
        if (classifications.length === 0 && navigator.onLine) {
            console.log("[ActivitiesTab] Catalogs empty, triggering sync...");
            syncEngine.triggerSync();
        }
    }, [classifications.length]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h3 className="font-bold text-blue-900">Actividades</h3>
                    <p className="text-sm text-blue-700">Gestiona tareas y eventos para esta oportunidad.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Actividad
                </button>
            </div>

            {(!sortedActivities || sortedActivities.length === 0) ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400">
                    <div className="flex justify-center mb-3">
                        <CalendarIcon className="w-10 h-10 text-slate-200" />
                    </div>
                    No hay actividades programadas. <br />
                    Crea una tarea o evento para dar seguimiento.
                </div>
            ) : (
                <div className="grid gap-4">
                    {sortedActivities.map((act) => {
                        const isOverdue = isDateOverdue(act.fecha_inicio) && !act.is_completed;

                        // Resolve Names (Robust matching using String conversion for type-safety)
                        const clsName = classifications.find(c => String(c.id) === String(act.clasificacion_id))?.nombre;
                        const subName = subclassifications.find(s => String(s.id) === String(act.subclasificacion_id))?.nombre;

                        return (
                            <div
                                key={act.id}
                                className={cn(
                                    "group p-4 bg-white rounded-2xl border transition-all hover:shadow-md cursor-pointer",
                                    act.is_completed
                                        ? "border-slate-100 opacity-75"
                                        : isOverdue
                                            ? "border-red-200 bg-red-50/30 hover:border-red-300 hover:shadow-red-100"
                                            : act.tipo_actividad === 'TAREA'
                                                ? "border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100"
                                                : "border-blue-200 hover:border-blue-300 hover:shadow-blue-100"
                                )}
                                onClick={() => {
                                    setSelectedActivity(act);
                                    setIsModalOpen(true);
                                }}
                            >
                                <div className="flex items-start gap-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleComplete(act.id, !act.is_completed);
                                        }}
                                        className="mt-1 transition-colors"
                                    >
                                        {act.is_completed ? (
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                        ) : isOverdue ? (
                                            <AlertCircle className="w-6 h-6 text-red-500" />
                                        ) : (
                                            <Circle className="w-6 h-6 text-slate-300 hover:text-blue-400" />
                                        )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                            <div>
                                                <h4 className={cn(
                                                    "font-bold text-lg",
                                                    act.is_completed ? "text-slate-500 line-through" : isOverdue ? "text-red-700" : "text-slate-900"
                                                )}>
                                                    {act.asunto}
                                                </h4>
                                                {(clsName || subName) && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {clsName && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{clsName}</span>}
                                                        {subName && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">{subName}</span>}
                                                    </div>
                                                )}
                                                {/* DEBUG INDICATOR */}
                                                {act.clasificacion_id && !clsName && (
                                                    <div className="text-[10px] text-red-500 font-bold mt-1">Error L: {act.clasificacion_id}</div>
                                                )}
                                            </div>
                                            {act.tipo_actividad === 'EVENTO' ? (
                                                <div className={cn(
                                                    "flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-lg",
                                                    isOverdue ? "text-red-600 bg-red-100" : "text-blue-600 bg-blue-50"
                                                )}>
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatColombiaDate(act.fecha_inicio, "dd/MM/yyyy p")}
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-lg",
                                                    isOverdue ? "text-red-600 bg-red-100" : "text-emerald-600 bg-emerald-50"
                                                )}>
                                                    {isOverdue ? <AlertCircle className="w-3.5 h-3.5" /> : <ListTodo className="w-3.5 h-3.5" />}
                                                    Tarea {act.fecha_inicio && `- ${formatColombiaDate(act.fecha_inicio, "dd/MM/yyyy")}`}
                                                </div>
                                            )}
                                        </div>

                                        {act.descripcion && (
                                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{act.descripcion}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <CreateActivityModal
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedActivity(null);
                    }}
                    onSubmit={async (data: any) => {
                        console.log("[ActivitiesTab] Modal Submitted Data:", data);
                        if (selectedActivity) {
                            await updateActivity(selectedActivity.id, data);
                        } else {
                            await createActivity(data);
                        }
                        setIsModalOpen(false);
                        setSelectedActivity(null);
                    }}
                    opportunities={opportunities}
                    initialOpportunityId={opportunityId}
                    initialData={selectedActivity}
                />
            )}
        </div>
    );
}

function CommissionBadge({ opportunityId }: { opportunityId: string }) {
    const [total, setTotal] = useState<number | null>(null);
    const [currency, setCurrency] = useState('COP');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCommission = async () => {
            try {
                const { data, error } = await supabase
                    .from('CRM_ComisionLedger')
                    .select('monto_comision, currency_id, tipo_evento')
                    .eq('oportunidad_id', opportunityId);

                if (error || !data || data.length === 0) {
                    setLoading(false);
                    return;
                }

                let sum = 0;
                for (const entry of data) {
                    sum += Number(entry.monto_comision) || 0;
                }
                setTotal(sum);
                setCurrency(data[0].currency_id || 'COP');
            } catch {
                // silently fail
            } finally {
                setLoading(false);
            }
        };
        fetchCommission();
    }, [opportunityId]);

    if (loading || total === null) return null;

    const formatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(total);

    return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Comision Devengada</p>
                    <p className="text-lg font-bold text-emerald-800">{formatted}</p>
                </div>
            </div>
            <Link href="/comisiones/ledger" className="text-xs font-bold text-emerald-700 hover:underline">
                Ver detalle
            </Link>
        </div>
    );
}
