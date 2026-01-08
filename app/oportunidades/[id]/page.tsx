"use client";

import { useOpportunities, useQuotes, useQuoteItems } from "@/lib/hooks/useOpportunities";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Plus, AlertCircle, Check, Trash2, Loader2, Truck, Package } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";

export default function OpportunityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { opportunities, deleteOpportunity } = useOpportunities();

    const opportunity = opportunities?.find(o => o.id === id);

    const [activeTab, setActiveTab] = useState<'resumen' | 'cotizaciones' | 'productos' | 'actividades'>('cotizaciones');

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
                status={opportunity.fase}
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
                    <div className="p-8 text-center text-slate-400 border-2 border-dashed rounded-xl">
                        Resumen KPIs y Timeline próximamente.
                    </div>
                )}
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
    const { quotes, createQuote, markAsWinner } = useQuotes(opportunityId);
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
                            <div key={q.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 flex justify-between group">
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

                                <div className="text-right flex flex-col items-end gap-2">
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
