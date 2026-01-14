"use client";

import { useOpportunities, useQuotes, useQuoteItems } from "@/lib/hooks/useOpportunities";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Plus, AlertCircle, Check, Trash2, Loader2, Truck, Package, Building, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
    Calendar as CalendarIcon,
    CheckCircle2,
    Circle,
    Clock,
    ListTodo
} from "lucide-react";
import { useActivities, LocalActivity } from "@/lib/hooks/useActivities";
import { CreateActivityModal } from "@/components/activities/CreateActivityModal";

export default function OpportunityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { opportunities, deleteOpportunity } = useOpportunities();

    const phases = useLiveQuery(() => db.phases.toArray());
    const phaseMap = new Map(phases?.map(p => [p.id, p.nombre]));

    const opportunity = opportunities?.find(o => o.id === id);

    const [activeTab, setActiveTab] = useState<'resumen' | 'cotizaciones' | 'productos' | 'actividades'>('resumen');

    const handleDelete = async () => {
        if (confirm("¿Estás seguro de que deseas eliminar esta oportunidad?")) {
            await deleteOpportunity(id);
            router.push("/oportunidades");
        }
    };

    if (!opportunity) return <div className="p-8 text-center text-slate-400">Cargando oportunidad...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <DetailHeader
                title={opportunity.nombre}
                subtitle={`${opportunity.currency_id} ${opportunity.amount}`}
                status={phaseMap.get(opportunity.fase_id) || opportunity.fase || 'Prospecto'}
                backHref="/oportunidades"
                actions={[
                    {
                        label: "Eliminar Oportunidad",
                        icon: Trash2,
                        variant: 'danger',
                        onClick: handleDelete
                    }
                ]}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

                {/* Sub-Tabs Nav */}
                <div className="flex space-x-6 border-b border-slate-200 mb-6">
                    {['resumen', 'cotizaciones', 'productos', 'actividades'].map(tab => (
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
                    <QuotesTab opportunityId={id} currency={opportunity.currency_id} />
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
        </div>
    );
}

function SummaryTab({ opportunity }: { opportunity: any }) {
    const { updateOpportunity } = useOpportunities();

    // Fetch Account
    const account = useLiveQuery(
        () => db.accounts.get(opportunity.account_id),
        [opportunity.account_id]
    );

    // Fetch Phases for Channel
    const phases = useLiveQuery(
        () => account?.canal_id
            ? db.phases.where('canal_id').equals(account.canal_id).sortBy('orden')
            : [],
        [account?.canal_id]
    );

    const handlePhaseChange = async (phaseId: number) => {
        await updateOpportunity(opportunity.id, { fase_id: phaseId });
    };

    if (!account) return <div className="p-8 text-center text-slate-400">Cargando datos del cliente...</div>;

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
                            {/* Connecting Line */}
                            <div className="absolute top-19 left-0 w-full h-1 bg-slate-100 rounded-full z-0" />

                            <div className="flex justify-between items-start relative z-10 w-full">
                                {phases.map((phase, index) => {
                                    const isFinal = phase.nombre.toLowerCase().includes('cerrada') || phase.nombre.toLowerCase().includes('ganada') || phase.nombre.toLowerCase().includes('perdida');
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
                                <div className="ml-10 relative -mt-10 h-28 w-48 shrink-0">
                                    {/* The "Y" Split Bracket Lines */}

                                    <div className="absolute left-0 top-[22%] bottom-[22%] w-1 bg-slate-100" /> {/* Vertical bar */}
                                    <div className="absolute left-0 top-[22%] w-4 h-1 bg-slate-100" /> {/* Top branch */}
                                    <div className="absolute left-0 bottom-[22%] w-4 h-1 bg-slate-100" /> {/* Bottom branch */}

                                    {phases.filter(p => p.nombre.toLowerCase().includes('cerrada') || p.nombre.toLowerCase().includes('ganada') || p.nombre.toLowerCase().includes('perdida')).map((phase) => {
                                        const isWon = phase.nombre.toLowerCase().includes('ganada');
                                        const isActive = opportunity.fase_id === phase.id;

                                        return (
                                            <button
                                                key={phase.id}
                                                onClick={() => handlePhaseChange(phase.id)}
                                                style={{ top: isWon ? '22%' : '78%' }}
                                                className={cn(
                                                    "absolute left-4 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all z-10 whitespace-nowrap",
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        href={`/cuentas?search=${account.nit || account.nombre}`}
                        className="mt-6 w-full py-2 bg-slate-50 hover:bg-blue-50 text-blue-600 text-sm font-bold rounded-xl border border-slate-100 hover:border-blue-200 text-center transition-all flex items-center justify-center gap-2"
                    >
                        Ver detalles en Cuentas <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Placeholder for other Summary info */}
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                        <AlertCircle className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Timeline y KPIs</p>
                    <p className="text-xs text-slate-400 max-w-[200px] mt-1">Próximamente visualización de historia y métricas de esta negociación.</p>
                </div>
            </div>
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

    const itemsToShow = (quoteItems && quoteItems.length > 0)
        ? quoteItems
        : (opportunity?.items || []);

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
                                    onChange={(e) => setSelectedQuoteId(e.target.value)}
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
                            <th className="px-4 py-3 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {itemsToShow.map((item: any) => (
                            <tr key={item.id || item.product_id}>
                                <td className="px-4 py-3 font-medium text-slate-900 min-w-[300px] max-w-sm">
                                    <div className="line-clamp-2 leading-tight">
                                        {item.descripcion_linea || item.nombre}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center text-slate-600">{item.cantidad}</td>
                                <td className="px-4 py-3 text-right text-slate-600">
                                    ${new Intl.NumberFormat().format(item.precio_unitario || item.precio || 0)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">
                                    ${new Intl.NumberFormat().format(item.subtotal || (item.cantidad * (item.precio_unitario || item.precio || 0)))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-slate-500">Total</td>
                            <td className="px-4 py-3 text-right text-blue-600 text-lg">
                                ${new Intl.NumberFormat().format(
                                    itemsToShow.reduce((acc: number, item: any) =>
                                        acc + (item.subtotal || (item.cantidad * (item.precio_unitario || item.precio || 0))), 0
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

    const handleMarkWinner = async (quote: any) => {
        if (!confirm(`¿Confirmas que deseas generar el pedido para la cotización ${quote.numero_cotizacion}? Esto cerrará las demás cotizaciones.`)) return;

        setProcessingId(quote.id);
        try {
            // @ts-ignore
            await markAsWinner(quote.id);
        } catch (e) {
            console.error(e);
            alert("Error al generar pedido");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (quote: any) => {
        if (!confirm(`¿Confirmas que deseas eliminar la cotización ${quote.numero_cotizacion}? Esta acción no se puede deshacer.`)) return;

        try {
            await deleteQuote(quote.id);
        } catch (e) {
            console.error(e);
            alert("Error al eliminar cotización");
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
                                        Creada el {new Date(q.updated_at || Date.now()).toLocaleDateString()}
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
        </div>
    );
}

function ActivitiesTab({ opportunityId }: { opportunityId: string }) {
    const { activities, createActivity, updateActivity, toggleComplete } = useActivities(opportunityId);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<LocalActivity | null>(null);
    const { opportunities } = useOpportunities();

    const sortedActivities = activities?.sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());

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
                    {sortedActivities.map((act) => (
                        <div
                            key={act.id}
                            className={cn(
                                "group p-4 bg-white rounded-2xl border transition-all hover:shadow-md cursor-pointer",
                                act.is_completed
                                    ? "border-slate-100 opacity-75"
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
                                    ) : (
                                        <Circle className="w-6 h-6 text-slate-300 hover:text-blue-400" />
                                    )}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className={cn(
                                            "font-bold text-lg",
                                            act.is_completed ? "text-slate-500 line-through" : "text-slate-900"
                                        )}>
                                            {act.asunto}
                                        </h4>
                                        {act.tipo_actividad === 'EVENTO' ? (
                                            <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(act.fecha_inicio).toLocaleDateString()} {new Date(act.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                <ListTodo className="w-3.5 h-3.5" />
                                                Tarea {act.fecha_inicio && `- ${new Date(act.fecha_inicio).toLocaleDateString()}`}
                                            </div>
                                        )}
                                    </div>

                                    {act.descripcion && (
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{act.descripcion}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <CreateActivityModal
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedActivity(null);
                    }}
                    onSubmit={(data: any) => {
                        if (selectedActivity) {
                            updateActivity(selectedActivity.id, data);
                        } else {
                            createActivity(data);
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
